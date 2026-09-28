import { z } from "zod";
import { datasetSchema } from "../dataset/dataset.schema";
import { costSchema } from "../contributor/cost.schema";
import { contributorSchema } from "../contributor/contributor.schema";
import { identifierSchema } from "../shared/identifier";

const dmpBase = z.object({
  dmp_id: z.string().optional(),
  title: z.string().min(1, "ต้องมีชื่อ"),
  description: z.string().min(1, "ต้องมีคำอธิบาย"),
  language: z.string().min(2),
  alternate_identifier: identifierSchema.optional(),
  // timeline
  begin_date: z.coerce.date(),
  end_date: z.coerce.date(),
  // ethical & legal (DMP-level)
  ethical_issues_exist: z.boolean(),
  ethical_issues_description: z.string().optional(),
  ethical_issues_report: z.string().url().or(z.literal("")).optional(),
  indigenous_considerations: z.string().optional(),
  // people & cost
  contributor: z.array(contributorSchema).min(1, "ต้องมีผู้ร่วมอย่างน้อย 1"),
  cost: z.array(costSchema).default([]),
  // data 
  dataset: z.array(datasetSchema).min(1, "ต้องมีอย่างน้อย 1 dataset"),
  // systeminfo
  schema_version: z.string().default("FAIRer maDMP 1.2"),
});

export const dmpSchema = dmpBase.superRefine((d, ctx) => {
  if (d.end_date < d.begin_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "end_date ต้องไม่ก่อน begin_date" });
  }
  if (d.ethical_issues_exist && !d.ethical_issues_description) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ethical_issues_description"], message: "ต้องอธิบายเมื่อมีประเด็นจริยธรรม" });
  }
  const contacts = d.contributor.filter((c) => c.is_contact).length;
  if (contacts !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contributor"], message: "ต้องมี contact เพียง 1 คน" });
  }
});
export type DmpForm = z.infer<typeof dmpSchema>;
export const dmpDraftSchema = dmpBase.partial();
export type DmpDraft = z.infer<typeof dmpDraftSchema>;
