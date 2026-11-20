import type { CourseMaterialRecord, CourseSection } from "./course-design";

/** Group an existing snapshot without changing it. Older or orphaned material stays visible. */
export function materialSectionIndex(material: Pick<CourseMaterialRecord, "sectionId">, sections: CourseSection[]): number {
  const index = sections.findIndex(section => section.id === material.sectionId);
  return index < 0 ? 0 : index;
}

export function materialKey(material: CourseMaterialRecord, index: number): string {
  return String(material.id || `material-${index + 1}`);
}

export function buildCourseOutline(sections: CourseSection[], materials: CourseMaterialRecord[]) {
  return sections.map((section, sectionIndex) => ({
    section,
    sectionIndex,
    items: materials.flatMap((material, index) => materialSectionIndex(material, sections) === sectionIndex
      ? [{ material, index, id: materialKey(material, index) }]
      : []),
  }));
}
