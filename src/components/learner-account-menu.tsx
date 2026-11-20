"use client";

import { useEffect, useRef } from "react";
import { BookOpen, ChevronDown, ClipboardList, GraduationCap, HelpCircle, Library, LogOut, NotebookPen, Settings, ScrollText, TrendingUp } from "lucide-react";

export function LearnerAccountMenu({ name, initials, onProfile }: {name:string;initials:string;onProfile:()=>void}) {
  const menu=useRef<HTMLDetailsElement>(null),trigger=useRef<HTMLElement>(null);
  useEffect(()=>{
    const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node && !menu.current?.contains(event.target) && menu.current)menu.current.open=false;};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape" && menu.current?.open){menu.current.open=false;trigger.current?.focus();}};
    document.addEventListener("pointerdown",dismiss);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",escape);};
  },[]);
  return <details className="portal-account-menu" ref={menu}>
    <summary className="profile-chip" ref={trigger} aria-label={`Account menu for ${name}`}><span>{initials||"UC"}</span><b>{name}</b><ChevronDown size={16} aria-hidden="true"/></summary>
    <nav className="portal-account-panel" aria-label="Learner account">
      <a href="/programmes"><GraduationCap/>My programmes</a>
      <a href="/?view=notes"><NotebookPen/>My notes</a>
      <a href="/programmes?record=transcripts"><ScrollText/>Transcripts</a>
      <a href="/programmes?record=progress"><TrendingUp/>Academic progress</a>
      <button onClick={()=>{if(menu.current)menu.current.open=false;onProfile();}}><Settings/>Settings and profile</button>
      <a href="/?view=support"><HelpCircle/>Help centre</a>
      <a href="/?view=resources"><GraduationCap/>Student resource centre</a>
      <a href="/library"><Library/>Open Access Library</a>
      <a href="/explore"><BookOpen/>Course catalogue</a>
      <a href="/?view=certificates"><ClipboardList/>Credential wallet</a>
      <a href="/signout-with-chatgpt?return_to=%2F"><LogOut/>Sign out</a>
    </nav>
  </details>;
}

export function LearnerResourceCentre() {
  const links = [
    {href:"/library",title:"Open Access Library",detail:"Find open books, articles and educational videos."},
    {href:"/?view=learning",title:"My courses",detail:"Continue your enrolled courses and learning activities."},
    {href:"/?view=notes",title:"My notes",detail:"Read and revisit your private lesson notes."},
    {href:"/?view=discussions",title:"Learning community",detail:"Join discussions with your course community."},
    {href:"/?view=support",title:"Learner support",detail:"Open and follow up on a support request."},
    {href:"/accessibility",title:"Accessibility",detail:"Find information on accessible learning."},
  ];
  return <section className="learner-notes-page" aria-labelledby="learner-resources-title"><p className="learner-notes-eyebrow">LEARNER SUPPORT</p><h2 id="learner-resources-title">Student resource centre</h2><p>Find the learning resources and support available to you.</p><div className="learner-resource-grid">{links.map(link=><a key={link.href} href={link.href}><strong>{link.title}</strong><span>{link.detail}</span></a>)}</div></section>;
}
