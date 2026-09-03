import { getRawDb } from "@/db/raw";
import { requireActiveProfile } from "@/lib/accounts";
import { deleteIdentityFilesOwnedBy, deleteStoredFile } from "@/lib/render-storage";

const CONFIRMATION_PHRASE = "DELETE ALL REGISTERED ACCOUNTS";
type CountRow = { total: number };

async function count(sql: string) {
  const row = await getRawDb().prepare(sql).first<CountRow>();
  return Number(row?.total ?? 0);
}

async function getScope() {
  const [registeredAccounts, learners, facilitators, incompleteRegistrations, pendingVerification, linkedRecords, preservedAdmins] = await Promise.all([
    count("SELECT COUNT(*) AS total FROM (SELECT email FROM users WHERE role != 'admin' UNION SELECT email FROM auth_accounts WHERE email NOT IN (SELECT email FROM users WHERE role = 'admin'))"),
    count("SELECT COUNT(*) AS total FROM users WHERE role = 'learner'"),
    count("SELECT COUNT(*) AS total FROM users WHERE role = 'facilitator'"),
    count("SELECT COUNT(*) AS total FROM auth_accounts a LEFT JOIN users u ON u.email = a.email WHERE u.email IS NULL"),
    count("SELECT COUNT(*) AS total FROM users WHERE role != 'admin' AND identity_status = 'pending_review'"),
    count("SELECT (SELECT COUNT(*) FROM enrollments) + (SELECT COUNT(*) FROM assessment_attempts) + (SELECT COUNT(*) FROM certificates) + (SELECT COUNT(*) FROM colab_submissions) + (SELECT COUNT(*) FROM virtual_lab_submissions) AS total"),
    count("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'"),
  ]);
  return { registeredAccounts, learners, facilitators, incompleteRegistrations, pendingVerification, linkedRecords, preservedAdmins, confirmationPhrase: CONFIRMATION_PHRASE };
}

export async function GET() {
  const account = await requireActiveProfile(["admin"]);
  if (account.error) return account.error;
  return Response.json({ scope: await getScope() }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request) {
  const account = await requireActiveProfile(["admin"]);
  if (account.error || !account.profile) return account.error;
  const payload = await request.json().catch(() => null) as { confirmation?: string; acknowledged?: boolean } | null;
  if (payload?.confirmation !== CONFIRMATION_PHRASE || payload.acknowledged !== true) {
    return Response.json({ error: `Type ${CONFIRMATION_PHRASE} and acknowledge the permanent deletion to continue.` }, { status: 400 });
  }

  const db = getRawDb();
  const scope = await getScope();
  const emailRows = await db.prepare("SELECT email FROM users WHERE role != 'admin' UNION SELECT email FROM auth_accounts WHERE email NOT IN (SELECT email FROM users WHERE role = 'admin')").all<{ email: string }>();
  const nonAdminEmails = emailRows.results.map((row) => row.email.toLowerCase());
  const fileRows = await db.prepare(`
    SELECT id_document_key AS file_key FROM users WHERE role != 'admin' AND id_document_key IS NOT NULL
    UNION SELECT selfie_key FROM users WHERE role != 'admin' AND selfie_key IS NOT NULL
    UNION SELECT notebook_key FROM colab_submissions WHERE notebook_key IS NOT NULL
    UNION SELECT evidence_key FROM virtual_lab_submissions WHERE evidence_key IS NOT NULL
  `).all<{ file_key: string }>();

  let deletion: Record<string, number> = {};
  try {
    db.exec("BEGIN IMMEDIATE");
    const coursesReassigned = await db.prepare("UPDATE course_drafts SET created_by_email = ? WHERE created_by_email IN (SELECT email FROM users WHERE role != 'admin')").bind(account.profile.email).run();
    await db.prepare("UPDATE course_drafts SET activated_by_email = ? WHERE activated_by_email IN (SELECT email FROM users WHERE role != 'admin')").bind(account.profile.email).run();
    const assignmentsReassigned = await db.prepare("UPDATE colab_assignments SET created_by_email = ? WHERE created_by_email IN (SELECT email FROM users WHERE role != 'admin')").bind(account.profile.email).run();
    const colabSubmissions = await db.prepare("DELETE FROM colab_submissions WHERE learner_email NOT IN (SELECT email FROM users WHERE role = 'admin')").run();
    const practicalSubmissions = await db.prepare("DELETE FROM virtual_lab_submissions WHERE learner_email NOT IN (SELECT email FROM users WHERE role = 'admin')").run();
    const credentials = await db.prepare("DELETE FROM certificates WHERE user_email NOT IN (SELECT email FROM users WHERE role = 'admin')").run();
    const attempts = await db.prepare("DELETE FROM assessment_attempts WHERE user_email NOT IN (SELECT email FROM users WHERE role = 'admin')").run();
    const enrollments = await db.prepare("DELETE FROM enrollments WHERE user_email NOT IN (SELECT email FROM users WHERE role = 'admin')").run();
    const profiles = await db.prepare("DELETE FROM users WHERE role != 'admin'").run();
    const signIns = await db.prepare("DELETE FROM auth_accounts WHERE email NOT IN (SELECT email FROM users WHERE role = 'admin')").run();
    deletion = {
      profiles: profiles.meta.changes,
      signIns: signIns.meta.changes,
      enrollments: enrollments.meta.changes,
      attempts: attempts.meta.changes,
      credentials: credentials.meta.changes,
      colabSubmissions: colabSubmissions.meta.changes,
      practicalSubmissions: practicalSubmissions.meta.changes,
      coursesReassigned: coursesReassigned.meta.changes,
      assignmentsReassigned: assignmentsReassigned.meta.changes,
    };
    await db.prepare("INSERT INTO admin_audit_log (admin_email, action, details_json) VALUES (?, 'delete_registered_accounts', ?)")
      .bind(account.profile.email, JSON.stringify({ scope, deletion })).run();
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* The transaction may not have started. */ }
    console.error("Registered-account deletion failed", error);
    return Response.json({ error: "The account reset could not be completed. No partial database deletion was retained." }, { status: 500 });
  }

  let filesRemoved = 0;
  let storageWarning = false;
  try {
    for (const key of new Set(fileRows.results.map((row) => row.file_key))) {
      if (await deleteStoredFile(key)) filesRemoved += 1;
    }
    filesRemoved += await deleteIdentityFilesOwnedBy(nonAdminEmails);
  } catch (error) {
    storageWarning = true;
    console.error("Account records were deleted, but some private file cleanup failed", error);
  }

  return Response.json({
    deleted: true,
    deletion,
    filesRemoved,
    preservedAdmins: scope.preservedAdmins,
    preservedInstitutionalContent: true,
    warning: storageWarning ? "Accounts were deleted, but an administrator should inspect the private upload store for residual files." : undefined,
  });
}
