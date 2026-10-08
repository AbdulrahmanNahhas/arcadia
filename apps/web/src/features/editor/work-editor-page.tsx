import type { WorkSnapshot } from "./document-model";
import { WorkWorkspace } from "./work-detail-page";

const emptyWork: WorkSnapshot = {
  revision: "new",
  document: {
    canonicalTitle: "",
    titleAr: null,
    summary: "",
    format: "animated",
    workflowStatus: "draft",
    isPrivate: false,
    audience: "general",
    age: "all",
    sexualityRisk: "none",
    behavioralRisk: "none",
    theologyRisk: "none",
    aliases: [],
    trivia: [],
    genres: [],
    tags: [],
    tones: [],
    countries: [],
    planets: [],
    credits: [],
    installments: [],
    awards: [],
    media: {},
    externalIds: [],
    relations: [],
  },
};
export function WorkEditorPage() {
  return <WorkWorkspace snapshot={emptyWork} create />;
}
