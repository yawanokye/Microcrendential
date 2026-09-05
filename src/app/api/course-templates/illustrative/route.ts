import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { requireActiveProfile } from "@/lib/accounts";
import { putStoredFile } from "@/lib/render-storage";

const bundledAssets = {
  casePack: { name: "Applied-Data-Literacy-Case-Pack.pdf", type: "application/pdf" },
  capstoneBrief: { name: "Applied-Data-Literacy-Capstone-Brief.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  notebook: { name: "Applied-Data-Literacy-Colab-Notebook.ipynb", type: "application/x-ipynb+json" },
  questionBank: { name: "Applied-Data-Literacy-Question-Bank.csv", type: "text/csv" },
} as const;

export async function POST(request: Request) {
  const account = await requireActiveProfile(["facilitator", "admin"]);
  if (account.error || !account.profile) return account.error;

  try {
    const origin = new URL(request.url).origin;
    const entries = await Promise.all(Object.entries(bundledAssets).map(async ([id, asset]) => {
      const body = Uint8Array.from(await readFile(join(process.cwd(), "public", "examples", asset.name)));
      const file = new File([body], asset.name, { type: asset.type });
      const key = await putStoredFile("course-materials", file, {
        contentType: asset.type,
        originalName: asset.name,
        ownerEmail: account.profile!.email,
        evidenceKind: "course-material",
      });
      return [id, { key, name: asset.name, size: body.byteLength, type: asset.type, publicUrl: `${origin}/examples/${asset.name}` }] as const;
    }));

    return Response.json({ assets: Object.fromEntries(entries) });
  } catch (error) {
    console.error("Could not prepare illustrative course assets", error);
    return Response.json({ error: "The illustrative course files could not be prepared." }, { status: 500 });
  }
}

