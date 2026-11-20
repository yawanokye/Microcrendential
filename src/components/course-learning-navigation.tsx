"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, Circle, ClipboardCheck, List, MessageSquareText } from "lucide-react";
import { buildCourseOutline } from "@/lib/course-outline";
import type { CourseMaterialRecord, CourseSection } from "@/lib/course-design";

export type CourseWorkspaceView = "overview" | "section" | "lesson" | "grades" | "assessment" | "course-notes";

type Props = {
  code: string;
  sections: CourseSection[];
  materials: CourseMaterialRecord[];
  completedIds: string[];
  activeSection: number;
  activeMaterial: string;
  view: CourseWorkspaceView;
  onView: (view: "overview" | "grades" | "assessment") => void;
  onSection: (index: number) => void;
  onMaterial: (material: CourseMaterialRecord, index: number) => void;
};

export function CourseLearningNavigation({ code, sections, materials, completedIds, activeSection, activeMaterial, view, onView, onSection, onMaterial }: Props) {
  const [openSections, setOpenSections] = useState<number[]>([activeSection]);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setOpenSections(current => current.includes(activeSection) ? current : [...current, activeSection]); }, [activeSection]);
  const outline = buildCourseOutline(sections, materials);
  const choose = (action: () => void) => { action(); setMenuOpen(false); };
  return <aside className="course-workspace-sidebar">
    <button className="course-workspace-mobile-toggle" aria-expanded={menuOpen} aria-controls="course-workspace-menu" onClick={() => setMenuOpen(value => !value)}><List size={19} /> Course menu <ChevronDown size={18}/></button>
    <nav id="course-workspace-menu" className={menuOpen ? "course-workspace-menu is-open" : "course-workspace-menu"} aria-label="Course contents">
      <p className="course-workspace-sidebar-label">COURSE NAVIGATION</p>
      <button className={view === "overview" ? "workspace-nav-link active" : "workspace-nav-link"} aria-current={view === "overview" ? "page" : undefined} onClick={() => choose(() => onView("overview"))}><BookOpen size={18}/> Course overview</button>
      <a className="workspace-nav-link" href={`/?view=discussions&courseCode=${encodeURIComponent(code)}`}><MessageSquareText size={18}/> Course discussion</a>
      <div className="workspace-module-list">{outline.map(({section, sectionIndex, items}) => {
        const isOpen = openSections.includes(sectionIndex);
        const completed = items.filter(item => completedIds.includes(item.id)).length;
        return <div className="workspace-module" key={section.id}>
          <div className="workspace-module-head"><button className={view === "section" && activeSection === sectionIndex ? "workspace-module-title active" : "workspace-module-title"} aria-current={view === "section" && activeSection === sectionIndex ? "page" : undefined} onClick={() => choose(() => {setOpenSections(current => current.includes(sectionIndex) ? current : [...current, sectionIndex]); onSection(sectionIndex);})}><span>{section.title}</span><small>{completed} of {items.length} completed</small></button><button className="workspace-module-toggle" aria-label={`${isOpen ? "Collapse" : "Expand"} ${section.title}`} aria-expanded={isOpen} aria-controls={`workspace-section-${sectionIndex}`} onClick={() => setOpenSections(current => isOpen ? current.filter(i => i !== sectionIndex) : [...current, sectionIndex])}><ChevronDown size={18} className={isOpen ? "expanded" : ""}/></button></div>
          <div id={`workspace-section-${sectionIndex}`} hidden={!isOpen} className="workspace-lesson-list">{items.length ? items.map(({material, index, id}, itemIndex) => <div key={id}>{material.unitTitle && (itemIndex === 0 || items[itemIndex - 1].material.unitTitle !== material.unitTitle) && <p className="workspace-unit-title">{material.unitTitle}</p>}<button className={view === "lesson" && activeMaterial === id ? "workspace-lesson active" : "workspace-lesson"} aria-current={view === "lesson" && activeMaterial === id ? "page" : undefined} onClick={() => choose(() => onMaterial(material, index))}>{completedIds.includes(id) ? <CheckCircle2 size={17}/> : <Circle size={17}/>}<span>{material.title}</span></button></div>) : <p className="workspace-empty-module">No lessons yet</p>}</div>
        </div>;
      })}</div>
      <button className={view === "assessment" ? "workspace-nav-link active" : "workspace-nav-link"} aria-current={view === "assessment" ? "page" : undefined} onClick={() => choose(() => onView("assessment"))}><ClipboardCheck size={18}/> Course assessment</button>
      <button className={view === "grades" ? "workspace-nav-link active" : "workspace-nav-link"} aria-current={view === "grades" ? "page" : undefined} onClick={() => choose(() => onView("grades"))}><List size={18}/> Grades and feedback</button>
    </nav>
  </aside>;
}
