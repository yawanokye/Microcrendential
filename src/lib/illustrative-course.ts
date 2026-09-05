import type { CourseDesign, CourseMaterialRecord } from "@/lib/course-design";

export type IllustrativeAsset = {
  key?: string;
  name: string;
  size: number;
  type: string;
  publicUrl: string;
};

export type IllustrativeTemplateAssets = {
  casePack: IllustrativeAsset;
  capstoneBrief: IllustrativeAsset;
  notebook: IllustrativeAsset;
  questionBank: IllustrativeAsset;
};

export type IllustrativePair = { left: string; right: string; image?: string };

export type IllustrativeQuestion = {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  points: number;
  scheme: string;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  learnerAdvice: string;
  outcomeIds: string[];
  pairs?: IllustrativePair[];
  videoUrl?: string;
  videoMode?: "whole" | "part" | "pause";
  videoStart?: number;
  videoEnd?: number;
  whiteboardEnabled?: boolean;
};

export type IllustrativeActivity = {
  id: string;
  kind: "colab" | "virtual_lab";
  title: string;
  instructions: string;
  required: boolean;
  passMark: number;
  attemptsAllowed: number;
  maxMark: number;
  dueAt: string;
  rubric: string;
  notebookKey?: string;
  notebookFileName?: string;
  templateUrl?: string;
  practicalId?: string;
  discipline?: string;
};

export type IllustrativeCourseTemplate = {
  code: string;
  title: string;
  description: string;
  discipline: string;
  design: CourseDesign;
  materials: CourseMaterialRecord[];
  activities: IllustrativeActivity[];
  assessmentModes: string[];
  assessmentConfig: {
    passMark: number;
    attempts: string;
    questions: IllustrativeQuestion[];
    questionFiles: Array<{ name: string; size: string; type: string; key?: string; url?: string }>;
  };
  gateRequired: boolean;
  questionLimit: number;
  certificateEnabled: boolean;
};

const readable = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const feedback = {
  correct: "Well done. Your answer is supported by the evidence and aligns with the stated learning outcome.",
  incorrect: "Not yet. Revisit the linked lesson, check the evidence and try the task again.",
  advice: "Use the course evidence checklist: identify the question, inspect the data, show your method, state limitations and justify the conclusion.",
};

function futureLocalDate(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1_000).toISOString().slice(0, 16);
}

function materialFile(asset: IllustrativeAsset) {
  return {
    fileKey: asset.key,
    fileName: asset.name,
    mimeType: asset.type,
    url: asset.publicUrl,
  };
}

export function buildIllustrativeCourseTemplate(origin: string, assets: IllustrativeTemplateAssets): IllustrativeCourseTemplate {
  const safeOrigin = origin.replace(/\/$/, "");
  const suffix = String(Date.now()).slice(-6);
  const design: CourseDesign = {
    category: "professional",
    deliveryPattern: "blended",
    level: "applied",
    language: "English",
    expectedHours: 30,
    enrolmentMode: "application",
    priceGhs: 450,
    intendedAudience: "Public-sector and local-government officers, NGO staff, lecturers, graduate students, business professionals and community leaders who need to interpret data and justify practical decisions.",
    prerequisites: "Basic computer and spreadsheet skills, access to a laptop or tablet with a reliable internet connection, and willingness to use free Google Colab. No prior programming experience is required.",
    accessibilityStatement: "All core lessons are supplied as structured readable HTML; downloadable documents have meaningful headings; videos include facilitator-reviewed English transcripts; images use descriptive labels; activities support keyboard navigation; and reasonable learning-support requests are referred through the UCC learner-support process.",
    objectives: [
      "Build practical confidence in asking answerable questions and judging the quality, provenance and limitations of data.",
      "Develop the ability to clean, summarise and visualise a small dataset with transparent and reproducible methods.",
      "Enable learners to communicate evidence-based recommendations ethically to academic, workplace and community audiences.",
      "Strengthen authentic assessment practice through process evidence, reflection and a short oral defence of submitted work.",
    ],
    outcomes: [
      { id: "illustrative-lo-1", statement: "Explain the data lifecycle and identify common quality, provenance, privacy and ethical risks in a supplied dataset.", skill: "Conceptual understanding", assessmentMethod: "Objective knowledge check" },
      { id: "illustrative-lo-2", statement: "Clean, summarise and visualise a small dataset in Google Colab using a reproducible workflow.", skill: "Data literacy", assessmentMethod: "Applied assignment or practical evidence" },
      { id: "illustrative-lo-3", statement: "Interpret a table or chart accurately and communicate a finding together with its uncertainty and limitations.", skill: "Professional communication", assessmentMethod: "Presentation or demonstration" },
      { id: "illustrative-lo-4", statement: "Defend an ethical, evidence-informed recommendation for a realistic University, workplace or community decision.", skill: "Ethical decision-making", assessmentMethod: "Oral assessment" },
    ],
    skills: [
      "Critical thinking",
      "Digital literacy",
      "Evidence-based decision-making",
      "Applied problem-solving",
      "Communication",
      "Data literacy",
      "Research and inquiry",
      "Responsible data storytelling",
    ],
    sections: [
      { id: "illustrative-section-1", title: "Orientation and evidence requirements", description: "Introduces the learning pathway, learner support, academic-integrity expectations and evidence required for the UCC credential." },
      { id: "illustrative-section-2", title: "Data foundations, quality and ethics", description: "Builds core language for data provenance, quality, privacy, consent, bias and responsible use." },
      { id: "illustrative-section-3", title: "Applied analysis and visualisation", description: "Guides learners through cleaning, summarising, visualising and checking a small authentic dataset." },
      { id: "illustrative-section-4", title: "Communication, capstone and credential", description: "Supports interpretation, recommendation writing, oral verification, reflection and the final credential gate." },
    ],
  };

  const orientationHtml = `<h2>Welcome to the illustrative microcredential</h2><p>This course shows facilitators what a complete, approval-ready learner journey looks like. Learners move from a real decision question to traceable evidence, analysis, communication and verification.</p><h3>Learning pathway</h3><ol><li>Review the course purpose, requirements and support routes.</li><li>Learn the principles of data quality, provenance, privacy and ethics.</li><li>Complete a guided Colab analysis and a virtual measurement practical.</li><li>Interpret the evidence, make a recommendation and defend the process.</li></ol><h3>Credential conditions</h3><p>The University of Cape Coast digital certificate is issued only after identity verification, achievement of the assessment pass mark and completion of every activity marked required.</p><h3>Learner support</h3><p>Use the course discussion area for academic questions and the support route for accessibility or technical assistance. Report access barriers early so an equivalent format can be arranged.</p>`;
  const ethicsHtml = `<h2>Data quality, provenance and ethical use</h2><p>A trustworthy conclusion depends on knowing who collected the data, why it was collected, how values were defined and what may be missing.</p><h3>Five checks before analysis</h3><ul><li><strong>Purpose:</strong> Is the dataset suitable for the decision question?</li><li><strong>Provenance:</strong> Can the source, collection method and date be traced?</li><li><strong>Quality:</strong> Are values complete, consistent, valid and timely?</li><li><strong>Representation:</strong> Who or what may be absent or under-represented?</li><li><strong>Ethics:</strong> Are privacy, consent, fairness and secure handling addressed?</li></ul><p>Record every material cleaning decision. Never silently delete inconvenient observations or present association as proof of causation.</p>`;
  const analysisHtml = `<h2>Worked example: from question to chart</h2><p><strong>Decision question:</strong> Which learner-support channel should receive additional attention next month?</p><ol><li>Inspect the data dictionary and identify the unit of analysis.</li><li>Check missing values, duplicate records, valid ranges and category spelling.</li><li>Calculate counts, percentages and a suitable measure of centre.</li><li>Create one chart whose title states the decision question.</li><li>Write a finding that distinguishes observation from interpretation.</li><li>State at least two limitations before making a recommendation.</li></ol><h3>Model interpretation</h3><p>The largest category is not automatically the most urgent. Compare volume with service time, completion, satisfaction and the reliability of each measure. A responsible recommendation states what the data supports and what it cannot establish.</p>`;
  const capstoneHtml = `<h2>Capstone evidence brief</h2><p>Use a supplied or approved local dataset to answer one practical decision question. Submit the cleaned data, reproducible notebook, one accessible chart, a 500-word recommendation and a short reflection describing limitations and ethical safeguards.</p><h3>Evidence checklist</h3><ul><li>Decision question and intended audience</li><li>Source, licence or permission and data dictionary</li><li>Cleaning log and reproducible analysis</li><li>Chart with title, units, source and descriptive text</li><li>Finding, limitations and justified recommendation</li><li>Three-minute oral defence or equivalent accessible verification</li></ul><p>The editable Word brief is retained as the original source while this HTML version provides a readable learner view.</p>`;

  const materials: CourseMaterialRecord[] = [
    { id: "illustrative-material-1", title: "Start here: pathway, support and certificate conditions", kind: "Read", source: "UCC course team", readableHtml: orientationHtml, plainText: readable(orientationHtml), sectionId: "illustrative-section-1", sectionTitle: "Orientation and evidence requirements", unitTitle: "Course orientation", estimatedMinutes: 25, outcomeIds: ["illustrative-lo-1", "illustrative-lo-4"], accessibilityChecked: true, license: "University of Cape Coast course-authored content" },
    { id: "illustrative-material-2", title: "Annotated community-indicators case pack", kind: "Download", source: "UCC course team", ...materialFile(assets.casePack), sectionId: "illustrative-section-1", sectionTitle: "Orientation and evidence requirements", unitTitle: "Case pack and data dictionary", estimatedMinutes: 45, outcomeIds: ["illustrative-lo-1", "illustrative-lo-2"], accessibilityChecked: true, license: "University of Cape Coast teaching use" },
    { id: "illustrative-material-3", title: "Data quality, provenance and ethical use", kind: "Read", source: "UCC course team", readableHtml: ethicsHtml, plainText: readable(ethicsHtml), sectionId: "illustrative-section-2", sectionTitle: "Data foundations, quality and ethics", unitTitle: "Core lesson", estimatedMinutes: 60, outcomeIds: ["illustrative-lo-1", "illustrative-lo-4"], accessibilityChecked: true, license: "University of Cape Coast course-authored content" },
    { id: "illustrative-material-4", title: "How a neural network learns: guided critical viewing", kind: "Watch", source: "3Blue1Brown · YouTube", url: "https://www.youtube-nocookie.com/embed/aircAruvnKk", externalUrl: "https://www.youtube.com/watch?v=aircAruvnKk", sectionId: "illustrative-section-2", sectionTitle: "Data foundations, quality and ethics", unitTitle: "Reviewed video with transcript", estimatedMinutes: 25, outcomeIds: ["illustrative-lo-1", "illustrative-lo-3"], accessibilityChecked: true, license: "YouTube; external creator content used by link", transcriptLanguage: "English", transcriptSource: "Facilitator-authored companion transcript for the illustrative template", transcriptPublished: true, transcript: "00:00 - The lesson introduces a neural network as a layered mathematical model. Learners should note that a visual explanation can make a complex process easier to inspect, but it does not remove the need to question the data and assumptions.\n\n02:00 - Inputs are transformed through weighted connections. The important data-literacy point is that model outputs depend on how variables are represented and on the examples used during learning.\n\n05:00 - The explanation connects model behaviour to adjustment and error. Pause and identify which quantities are observed, calculated or assumed.\n\n08:00 - The visualisation shows how repeated adjustments can improve performance on a defined task. Performance on one dataset does not guarantee fairness, validity or usefulness in another context.\n\n11:00 - Before accepting a model output, document provenance, intended use, possible bias, uncertainty and the human decision that follows.\n\nFacilitator note: this is a concise accessible companion transcript for the illustrative template, not a verbatim reproduction. Replace it with an exact reviewed caption transcript before using this external video in a live course." },
    { id: "illustrative-material-5", title: "Worked example: interpreting a community-service dataset", kind: "Read", source: "UCC course team", readableHtml: analysisHtml, plainText: readable(analysisHtml), sectionId: "illustrative-section-3", sectionTitle: "Applied analysis and visualisation", unitTitle: "Worked example", estimatedMinutes: 75, outcomeIds: ["illustrative-lo-2", "illustrative-lo-3"], accessibilityChecked: true, license: "University of Cape Coast course-authored content" },
    { id: "illustrative-material-6", title: "World Bank Open Data explorer", kind: "Embed", source: "World Bank Open Data", url: "https://data.worldbank.org/", externalUrl: "https://data.worldbank.org/", sectionId: "illustrative-section-3", sectionTitle: "Applied analysis and visualisation", unitTitle: "Public-data exploration", estimatedMinutes: 40, outcomeIds: ["illustrative-lo-2", "illustrative-lo-3"], accessibilityChecked: true, license: "External public resource; verify current source terms before publication" },
    { id: "illustrative-material-7", title: "Capstone evidence and oral-defence brief", kind: "Read", source: "UCC course team", ...materialFile(assets.capstoneBrief), readableHtml: capstoneHtml, plainText: readable(capstoneHtml), sectionId: "illustrative-section-4", sectionTitle: "Communication, capstone and credential", unitTitle: "Editable Word brief and readable HTML", estimatedMinutes: 45, outcomeIds: ["illustrative-lo-2", "illustrative-lo-3", "illustrative-lo-4"], accessibilityChecked: true, license: "University of Cape Coast teaching use" },
  ];

  const activities: IllustrativeActivity[] = [
    { id: "illustrative-activity-colab", kind: "colab", title: "Required Colab data-cleaning and visualisation notebook", instructions: "Download or open the supplied notebook in free Google Colab. Run every setup cell, complete the marked cleaning and chart tasks, keep the original data visible, explain each decision, then submit the completed .ipynb file or an authorised sharing link.", required: true, passMark: 70, attemptsAllowed: 3, maxMark: 100, dueAt: futureLocalDate(21), rubric: "Data inspection and documented cleaning: 25 marks; correct summary calculations: 20; appropriate accessible visualisation: 20; interpretation and limitations: 20; reproducibility, code clarity and citations: 15.", notebookKey: assets.notebook.key, notebookFileName: assets.notebook.name, templateUrl: assets.notebook.publicUrl },
    { id: "illustrative-activity-lab-required", kind: "virtual_lab", title: "Required virtual measurement and data-quality practical", instructions: "Complete the safety gate, choose appropriate equipment, record three measurements with units, calculate a mean, report uncertainty and submit a structured practical report explaining what would require confirmation in a supervised physical laboratory.", required: true, passMark: 70, attemptsAllowed: 2, maxMark: 100, dueAt: futureLocalDate(24), rubric: "Safety decision: 15 marks; equipment and procedure: 20; complete observations with units: 20; calculation and interpretation: 25; limitations, documentation and reflection: 20.", practicalId: "science-measurement-safety", discipline: "General Science" },
    { id: "illustrative-activity-lab-optional", kind: "virtual_lab", title: "Optional enrichment: Ohm's law data interpretation", instructions: "Use the virtual circuit to collect paired voltage and current observations, plot the relationship and explain whether the evidence is consistent with a constant resistance.", required: false, passMark: 60, attemptsAllowed: 3, maxMark: 50, dueAt: futureLocalDate(28), rubric: "Safe setup: 10 marks; complete data table: 15; graph and units: 10; interpretation and limitations: 15.", practicalId: "physics-ohms-law", discipline: "Physics" },
  ];

  const common = { ...feedback };
  const questions: IllustrativeQuestion[] = [
    { id: "illustrative-q-1", type: "Multiple choice", prompt: "Which action provides the strongest evidence that a dataset is suitable for a decision?", options: ["Check its source, definitions, collection method and limitations", "Choose the largest available file", "Remove every unusual value", "Use the first chart produced"], correctAnswer: "Check its source, definitions, collection method and limitations", points: 2, scheme: "2 marks for selecting the complete provenance-and-quality check; 0 otherwise.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: common.advice, outcomeIds: ["illustrative-lo-1"] },
    { id: "illustrative-q-2", type: "True / false", prompt: "A correlation between two variables, by itself, proves that one variable caused the other.", options: ["True", "False"], correctAnswer: "False", points: 1, scheme: "1 mark for False; correlation alone does not establish causation.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Review the worked example on observation, interpretation and causal claims.", outcomeIds: ["illustrative-lo-1", "illustrative-lo-3"] },
    { id: "illustrative-q-3", type: "Fill in", prompt: "Three service-time observations are 12, 15 and 18 minutes. Enter the arithmetic mean in minutes and show your working on the whiteboard.", options: [], correctAnswer: "15", points: 3, scheme: "1 mark for adding the observations, 1 mark for dividing by three and 1 mark for the correct mean of 15 minutes.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Add all observations and divide by the number of observations. Retain the unit in your written working.", outcomeIds: ["illustrative-lo-2"], whiteboardEnabled: true },
    { id: "illustrative-q-4", type: "Matching", prompt: "Match each data-quality dimension to its meaning.", options: [], correctAnswer: "", points: 4, scheme: "1 mark for each correct match.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Review the five checks before analysis in Section 2.", outcomeIds: ["illustrative-lo-1"], pairs: [{ left: "Completeness", right: "Required values are present" }, { left: "Validity", right: "Values follow defined rules" }, { left: "Consistency", right: "The same definition is used throughout" }, { left: "Timeliness", right: "The data is current enough for the decision" }] },
    { id: "illustrative-q-5", type: "Drag and drop", prompt: "Place each analysis step beside its correct purpose.", options: [], correctAnswer: "", points: 4, scheme: "1 mark for each correctly placed step.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Follow the question-to-recommendation workflow in the worked example.", outcomeIds: ["illustrative-lo-2", "illustrative-lo-3"], pairs: [{ left: "Inspect", right: "Understand fields, units and missingness" }, { left: "Clean", right: "Correct documented quality problems" }, { left: "Visualise", right: "Reveal a relevant pattern clearly" }, { left: "Interpret", right: "Explain meaning, uncertainty and limits" }] },
    { id: "illustrative-q-6", type: "Picture matching", prompt: "Match each pictured learning environment to the evidence it is designed to produce.", options: [], correctAnswer: "", points: 3, scheme: "1 mark for each correct environment-to-evidence match.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Use the visual setting, equipment and activity purpose as evidence.", outcomeIds: ["illustrative-lo-1", "illustrative-lo-3"], pairs: [{ left: "Science laboratory", right: "Repeated measurements and uncertainty", image: `${safeOrigin}/labs/science-lab-workbench.webp` }, { left: "Engineering bench", right: "Input-output measurements and model comparison", image: `${safeOrigin}/labs/engineering-electronics-bench.webp` }, { left: "Clinical simulation", right: "Safe sequence, observations and handover", image: `${safeOrigin}/labs/clinical-simulation-room.webp` }] },
    { id: "illustrative-q-7", type: "Video question", prompt: "After viewing the configured segment, which statement best describes responsible interpretation of a model output?", options: ["Document the data, assumptions, limits and intended use", "Treat every output as an objective fact", "Hide uncertainty from the audience", "Use the model outside its intended context without review"], correctAnswer: "Document the data, assumptions, limits and intended use", points: 2, scheme: "2 marks for the evidence-and-limitations response after the viewing gate.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Replay the segment and note the distinction between a model explanation and evidence of validity in context.", outcomeIds: ["illustrative-lo-1", "illustrative-lo-4"], videoUrl: "https://www.youtube-nocookie.com/embed/aircAruvnKk", videoMode: "part", videoStart: 0, videoEnd: 45 },
    { id: "illustrative-q-8", type: "Short answer", prompt: "Write two sentences that accurately communicate a finding and one important limitation from the supplied community-service chart.", options: [], correctAnswer: "The response states the observed pattern without claiming causation and identifies a relevant limitation such as missing values, sample coverage or measurement quality.", points: 4, scheme: "Observed pattern: 2 marks; relevant limitation: 1; clear non-causal language: 1.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Use the pattern + evidence + limitation sentence structure from Section 3.", outcomeIds: ["illustrative-lo-3"] },
    { id: "illustrative-q-9", type: "Essay", prompt: "In 400-500 words, evaluate whether the supplied dataset provides sufficient evidence to change the learner-support allocation for next month.", options: [], correctAnswer: "A strong response defines the decision, evaluates provenance and quality, interprets relevant measures, identifies uncertainty and ethical issues, and gives a proportionate recommendation.", points: 10, scheme: "Decision framing: 2; evidence use: 3; quality and limitations: 2; ethical reasoning: 1; justified recommendation and clarity: 2.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Organise the response as decision, evidence, limitations, recommendation and next evidence needed.", outcomeIds: ["illustrative-lo-1", "illustrative-lo-3", "illustrative-lo-4"] },
    { id: "illustrative-q-10", type: "Scenario response", prompt: "A manager asks you to remove dissatisfied respondents before presenting results. Explain the action you would take and why.", options: [], correctAnswer: "Refuse to remove valid responses merely because they are inconvenient; preserve the original data, document any legitimate exclusion rule, report sensitivity and escalate the ethical concern through the approved process.", points: 6, scheme: "Protects valid evidence: 2; documents rules and provenance: 2; reports impact or sensitivity: 1; appropriate escalation: 1.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Apply integrity, transparency, proportionality and accountability.", outcomeIds: ["illustrative-lo-4"] },
    { id: "illustrative-q-11", type: "Oral defence prompt", prompt: "In three minutes, defend one cleaning decision and one limitation in your submitted notebook, then answer one facilitator follow-up question.", options: [], correctAnswer: "The learner identifies the affected field, explains the rule and evidence, shows the before-and-after effect, acknowledges uncertainty and answers consistently with the submitted notebook.", points: 8, scheme: "Traceable cleaning decision: 3; limitation and consequence: 2; consistency with submitted evidence: 2; concise professional response: 1.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Open your notebook and cleaning log during the defence. Explain what you did, why you did it and what changed.", outcomeIds: ["illustrative-lo-2", "illustrative-lo-4"] },
    { id: "illustrative-q-12", type: "Evidence upload prompt", prompt: "Submit the cleaned dataset, completed notebook, exported accessible chart and a one-page process log showing timestamps or version history.", options: [], correctAnswer: "Four traceable files are provided, open correctly, use consistent identifiers and collectively show the learner's analysis process.", points: 10, scheme: "Cleaned data: 2; runnable notebook: 3; accessible chart: 2; traceable process log: 2; consistent file naming: 1.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Use the prescribed file names and check that another person can open and reproduce the work.", outcomeIds: ["illustrative-lo-2", "illustrative-lo-3"] },
    { id: "illustrative-q-13", type: "Practical assignment", prompt: "Complete the capstone: answer one approved local decision question using a small dataset and submit the full evidence package described in the Word brief.", options: [], correctAnswer: "The submission contains an approved question, lawful data source, data dictionary, documented cleaning, reproducible analysis, accessible visual, limitations, ethical recommendation and reflection.", points: 20, scheme: "Question and source: 3; data quality and ethics: 4; reproducible analysis: 4; visual and interpretation: 3; limitations: 2; recommendation: 2; reflection and presentation: 2.", feedbackCorrect: common.correct, feedbackIncorrect: common.incorrect, learnerAdvice: "Use the downloadable capstone brief as the final submission checklist.", outcomeIds: ["illustrative-lo-2", "illustrative-lo-3", "illustrative-lo-4"] },
  ];

  return {
    code: `UCC-ILL-DATA-${suffix}`,
    title: "Applied Data Literacy for Evidence-Based Decision-Making (Illustrative Course)",
    description: "A complete facilitator exemplar showing how to design an accessible, outcome-led UCC microcredential. Learners investigate data quality and ethics, complete reproducible analysis in free Google Colab, practise measurement in a visual virtual laboratory, communicate limitations, defend a recommendation and satisfy the verified digital-certificate gate.",
    discipline: "Interdisciplinary",
    design,
    materials,
    activities,
    assessmentModes: ["Objective quiz", "Video watch + answer", "Pause check", "Short answer", "Essay / reflection", "Practical assignment", "Viva / oral defence", "Authentic evidence"],
    assessmentConfig: {
      passMark: 70,
      attempts: "3",
      questions,
      questionFiles: [{ name: assets.questionBank.name, size: `${Math.max(1, Math.round(assets.questionBank.size / 1024))} KB`, type: assets.questionBank.type, key: assets.questionBank.key, url: assets.questionBank.publicUrl }],
    },
    gateRequired: true,
    questionLimit: questions.length,
    certificateEnabled: true,
  };
}

