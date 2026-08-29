export type LabDiscipline = "General Science" | "Physics" | "Chemistry" | "Biology" | "Nursing Skills" | "Medicine" | "Engineering";

export type VirtualPractical = {
  id: string;
  discipline: LabDiscipline;
  title: string;
  focus: string;
  mode: "measurement" | "sequence" | "decision";
  objectives: string[];
  equipment: string[];
  safetyQuestion: string;
  safetyOptions: string[];
  safetyAnswer: string;
  procedureSteps: string[];
  checkpointQuestion: string;
  checkpointOptions: string[];
  checkpointAnswer: string;
  parameterLabel: string;
  parameterUnit: string;
  parameterMin: number;
  parameterMax: number;
  parameterDefault: number;
  resultLabel: string;
  resultUnit: string;
  resultFactor: number;
  debrief: string;
};

export const labDisciplines: LabDiscipline[] = ["General Science", "Physics", "Chemistry", "Biology", "Nursing Skills", "Medicine", "Engineering"];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const sciencePracticals: VirtualPractical[] = [
  {
    id: "science-measurement-safety", discipline: "General Science", title: "Laboratory measurement and safety", focus: "Select equipment, estimate uncertainty and record repeat measurements.", mode: "measurement",
    objectives: ["Recognise common laboratory equipment", "Record measurements with appropriate units", "Apply core laboratory-safety decisions"],
    equipment: ["Digital balance", "Measuring cylinder", "Safety goggles", "Results table"],
    safetyQuestion: "What should happen before any practical begins?", safetyOptions: ["Complete the risk and safety check", "Start the apparatus immediately", "Remove protective equipment"], safetyAnswer: "Complete the risk and safety check",
    procedureSteps: ["Inspect the virtual apparatus", "Select the correct measuring range", "Take three readings", "Record the mean and uncertainty"],
    checkpointQuestion: "Why should a measurement be repeated?", checkpointOptions: ["To estimate consistency and reduce random error", "To change the unit", "To avoid recording a result"], checkpointAnswer: "To estimate consistency and reduce random error",
    parameterLabel: "Sample mass", parameterUnit: "g", parameterMin: 10, parameterMax: 100, parameterDefault: 50, resultLabel: "Measured volume", resultUnit: "mL", resultFactor: 0.8,
    debrief: "Compare repeated readings, identify possible sources of uncertainty and explain why the selected equipment was appropriate.",
  },
  {
    id: "physics-ohms-law", discipline: "Physics", title: "Ohm's law and circuit measurement", focus: "Adjust voltage, observe current and interpret a virtual circuit.", mode: "measurement",
    objectives: ["Identify circuit components", "Relate voltage, current and resistance", "Plot and interpret measurement data"],
    equipment: ["DC supply", "Resistor", "Ammeter", "Voltmeter"],
    safetyQuestion: "Before changing a circuit connection, what should be done?", safetyOptions: ["Switch off the supply", "Increase the voltage", "Touch exposed conductors"], safetyAnswer: "Switch off the supply",
    procedureSteps: ["Inspect the circuit", "Confirm meter connections", "Adjust voltage", "Record current"],
    checkpointQuestion: "For constant resistance, what happens to current when voltage increases?", checkpointOptions: ["Current increases proportionally", "Current becomes zero", "Resistance disappears"], checkpointAnswer: "Current increases proportionally",
    parameterLabel: "Applied voltage", parameterUnit: "V", parameterMin: 1, parameterMax: 12, parameterDefault: 6, resultLabel: "Circuit current", resultUnit: "A", resultFactor: 0.1,
    debrief: "Use the recorded voltage and current values to estimate resistance and comment on whether the relationship is linear.",
  },
  {
    id: "chemistry-acid-base", discipline: "Chemistry", title: "Virtual acid-base analysis", focus: "Observe a simulated indicator response and interpret neutralisation data.", mode: "measurement",
    objectives: ["Recognise virtual titration apparatus", "Interpret an indicator endpoint", "Record and analyse volume data"],
    equipment: ["Virtual burette", "Conical flask", "Indicator", "Protective goggles"],
    safetyQuestion: "How should this activity be treated outside the platform?", safetyOptions: ["As a simulation only unless supervised in an approved laboratory", "As permission to mix household chemicals", "Without protective controls"], safetyAnswer: "As a simulation only unless supervised in an approved laboratory",
    procedureSteps: ["Check the virtual apparatus", "Set the starting reading", "Add virtual reagent gradually", "Record the endpoint"],
    checkpointQuestion: "What indicates the simulated endpoint?", checkpointOptions: ["A persistent indicator colour change", "A larger flask", "The disappearance of the scale"], checkpointAnswer: "A persistent indicator colour change",
    parameterLabel: "Virtual reagent volume", parameterUnit: "mL", parameterMin: 5, parameterMax: 30, parameterDefault: 15, resultLabel: "Calculated concentration", resultUnit: "mol/L", resultFactor: 0.01,
    debrief: "Explain how the endpoint was identified and how measurement uncertainty could affect the calculated concentration.",
  },
  {
    id: "biology-cell-microscopy", discipline: "Biology", title: "Cell microscopy and observation", focus: "Select magnification, focus a virtual specimen and document cell features.", mode: "measurement",
    objectives: ["Identify microscope components", "Select suitable magnification", "Record biological observations accurately"],
    equipment: ["Virtual microscope", "Prepared slide", "Objective lenses", "Observation sheet"],
    safetyQuestion: "What is the correct way to begin focusing?", safetyOptions: ["Start with the lowest-power objective", "Begin with maximum magnification", "Remove the slide holder"], safetyAnswer: "Start with the lowest-power objective",
    procedureSteps: ["Place the virtual slide", "Select low power", "Adjust focus", "Increase magnification and record features"],
    checkpointQuestion: "What happens to field of view as magnification increases?", checkpointOptions: ["It becomes smaller", "It becomes unlimited", "It remains identical"], checkpointAnswer: "It becomes smaller",
    parameterLabel: "Magnification", parameterUnit: "×", parameterMin: 40, parameterMax: 400, parameterDefault: 100, resultLabel: "Relative field of view", resultUnit: "%", resultFactor: 0.2,
    debrief: "Describe the visible cell features and explain how magnification affected detail and field of view.",
  },
];

const nursingTitles = [
  "Vital-sign assessment", "Infection prevention and hand hygiene", "Wound-care simulation", "Medication-administration checks", "Patient positioning and mobility", "Maternal and newborn scenario", "Emergency response and CPR decision-making", "Nursing documentation and clinical handover", "Video submission of supervised skills",
];

const nursingPracticals: VirtualPractical[] = nursingTitles.map((title) => ({
  id: `nursing-${slug(title)}`, discipline: "Nursing Skills", title, focus: "Practise a safe, documented clinical-skills sequence with a virtual patient.", mode: "sequence",
  objectives: [`Apply the approved sequence for ${title.toLowerCase()}`, "Communicate safely with a simulated patient", "Document actions and escalate concerns appropriately"],
  equipment: ["Virtual patient record", "Procedure checklist", "PPE selection", "Observation chart"],
  safetyQuestion: "What is required before interacting with the simulated patient?", safetyOptions: ["Confirm identity, consent and applicable precautions", "Assume identity from the bed location", "Skip hand hygiene"], safetyAnswer: "Confirm identity, consent and applicable precautions",
  procedureSteps: ["Confirm identity, consent and precautions", "Explain the simulated procedure", "Complete the approved skills sequence", "Document findings and escalate concerns"],
  checkpointQuestion: "What should happen when an abnormal finding appears?", checkpointOptions: ["Document and escalate according to the approved protocol", "Ignore it because this is a simulation", "Alter the record"], checkpointAnswer: "Document and escalate according to the approved protocol",
  parameterLabel: "Protocol completion", parameterUnit: "%", parameterMin: 25, parameterMax: 100, parameterDefault: 75, resultLabel: "Virtual safety index", resultUnit: "%", resultFactor: 0.95,
  debrief: "Reflect on communication, patient safety, documentation and the steps that require supervised physical demonstration.",
}));

const medicineTitles = [
  "Virtual patient consultation", "History taking and physical-examination sequencing", "Clinical reasoning and differential diagnosis", "Laboratory and imaging interpretation", "Medication and prescription-safety exercise", "Emergency and triage scenario", "Anatomy, physiology and pathology activity", "Structured clinical examination station",
];

const medicinePracticals: VirtualPractical[] = medicineTitles.map((title) => ({
  id: `medicine-${slug(title)}`, discipline: "Medicine", title, focus: "Work through a fictional clinical case for education and assessment only.", mode: "decision",
  objectives: [`Apply structured reasoning to ${title.toLowerCase()}`, "Recognise red flags in a fictional case", "Justify a safe next educational decision"],
  equipment: ["Fictional patient record", "Observation panel", "Reference values", "Decision log"],
  safetyQuestion: "How may this virtual case be used?", safetyOptions: ["For supervised education—not diagnosis or treatment of a real person", "To prescribe for a real patient", "To replace clinical supervision"], safetyAnswer: "For supervised education—not diagnosis or treatment of a real person",
  procedureSteps: ["Review the fictional presentation", "Identify relevant information and red flags", "Select and justify the safest next step", "Document the reasoning for debriefing"],
  checkpointQuestion: "What is the safest response when the scenario contains a red flag?", checkpointOptions: ["Escalate through the stated clinical-supervision pathway", "Continue without documenting it", "Give personal medical advice"], checkpointAnswer: "Escalate through the stated clinical-supervision pathway",
  parameterLabel: "Case-information reviewed", parameterUnit: "%", parameterMin: 25, parameterMax: 100, parameterDefault: 75, resultLabel: "Reasoning completeness", resultUnit: "%", resultFactor: 0.9,
  debrief: "Compare the decision with the approved case rubric, identify missed cues and separate educational simulation from real clinical decision-making.",
}));

const engineeringTitles = [
  "Electrical and electronic circuits", "Mechanics and materials testing", "Thermodynamics and heat transfer", "Fluid mechanics", "Structural and civil-engineering simulation", "CAD and technical drawing", "Control systems, sensors and PLC exercise", "Python, R and engineering-data analysis through Colab", "Virtual instruments, measurements, tables and graphs",
];

const engineeringPracticals: VirtualPractical[] = engineeringTitles.map((title, index) => ({
  id: `engineering-${slug(title)}`, discipline: "Engineering", title, focus: "Change a virtual input, observe the model response and analyse engineering data.", mode: "measurement",
  objectives: [`Investigate ${title.toLowerCase()}`, "Record measurements with units", "Compare the model response with an engineering expectation"],
  equipment: ["Virtual test rig", "Digital instrument", "Control panel", "Engineering worksheet"],
  safetyQuestion: "Before operating physical engineering equipment, what is required?", safetyOptions: ["Approved risk controls and competent supervision", "Only completion of this virtual activity", "No inspection"], safetyAnswer: "Approved risk controls and competent supervision",
  procedureSteps: ["Inspect the virtual system", "Set an input within the safe range", "Run and repeat the model", "Record and interpret the response"],
  checkpointQuestion: "What makes an engineering result traceable?", checkpointOptions: ["Recorded inputs, units, assumptions and observations", "A result without units", "Deleting unexpected readings"], checkpointAnswer: "Recorded inputs, units, assumptions and observations",
  parameterLabel: "Virtual input", parameterUnit: "units", parameterMin: 10, parameterMax: 100, parameterDefault: 50, resultLabel: "Model response", resultUnit: "units", resultFactor: Number((0.45 + index * 0.05).toFixed(2)),
  debrief: "Discuss the model assumptions, sources of uncertainty and which conclusions would require confirmation in a physical laboratory.",
}));

export const virtualPracticals: VirtualPractical[] = [...sciencePracticals, ...nursingPracticals, ...medicinePracticals, ...engineeringPracticals];

export function getVirtualPractical(id: string) {
  return virtualPracticals.find((item) => item.id === id);
}
