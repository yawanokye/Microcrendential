import { ArrowLeft, CheckCircle2, ChevronRight, ShieldCheck, Users } from "lucide-react";
import { UccBrandLockup } from "@/components/ucc-brand";

export default function StaffAdminEntry() {
  return (
    <main className="access-shell commercial-access private-staff-access">
      <section className="access-card access-selector">
        <div className="access-brand">
          <UccBrandLockup subtitle="Restricted Staff Gateway" />
        </div>
        <div className="access-product-heading">
          <div>
            <p className="eyebrow">RESTRICTED STAFF GATEWAY</p>
            <h1>Select your authorised workspace.</h1>
            <p>This private page is not advertised on the learner-facing site. Account roles are verified before access is granted.</p>
          </div>
          <a href="/"><ArrowLeft /> Public website</a>
        </div>
        <div className="commercial-role-grid staff-private-grid">
          <article className="commercial-role-card facilitator">
            <header><span><ShieldCheck /></span><em>FOR EDUCATORS</em></header>
            <h2>Facilitator Portal</h2>
            <p>Design programmes, facilitate cohorts, review evidence and make competency decisions.</p>
            <ul>
              <li><CheckCircle2 /> Course and assessment studio</li>
              <li><CheckCircle2 /> Learner evidence and marking</li>
              <li><CheckCircle2 /> Cohort performance intelligence</li>
            </ul>
            <div><a className="role-primary" href="/facilitator-signin">Facilitator sign in <ChevronRight /></a><small>Administrator invitation required</small></div>
          </article>
          <article className="commercial-role-card admin">
            <header><span><Users /></span><em>FOR GOVERNANCE</em></header>
            <h2>System Administration</h2>
            <p>Govern identities, record committee decisions, protect credential integrity and monitor institutional performance.</p>
            <ul>
              <li><CheckCircle2 /> User and access governance</li>
              <li><CheckCircle2 /> Committee decision records</li>
              <li><CheckCircle2 /> Credential registry and audit</li>
            </ul>
            <div><a className="role-primary" href="/admin-signin">Administrator sign in <ChevronRight /></a><small>Restricted system role</small></div>
          </article>
        </div>
        <footer className="access-trust"><ShieldCheck /><span>Knowing this address does not grant access. The selected portal must match the account role.</span></footer>
      </section>
    </main>
  );
}
