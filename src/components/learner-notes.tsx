"use client";

import { useCallback, useEffect, useState } from "react";

type Note = { noteKey:string; courseCode:string; courseTitle:string; materialId:string|null; label:string; note:string; updatedAt:string };

export function LearnerNotes() {
  const [items,setItems]=useState<Note[]>([]),[next,setNext]=useState<number|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=useCallback(async(offset=0)=>{
    setLoading(true);setError("");
    try {
      const response=await fetch(`/api/delivery?area=notes&offset=${offset}`,{cache:"no-store"});
      const data=await response.json() as {items?:Note[];nextOffset?:number|null;error?:string};
      if(!response.ok)throw new Error(data.error||"Your notes could not be loaded.");
      setItems(current=>offset ? [...current,...(data.items||[])] : data.items||[]);
      setNext(data.nextOffset??null);
    } catch(reason) {setError(reason instanceof Error ? reason.message : "Your notes could not be loaded.");}
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  return <section className="learner-notes-page" aria-labelledby="learner-notes-title">
    <p className="learner-notes-eyebrow">PRIVATE LEARNING WORKSPACE</p><h2 id="learner-notes-title">My notes</h2>
    <p>Find notes you saved in your courses. Only your account can see them.</p>
    {error && <div role="alert"><p>{error}</p><button onClick={()=>void load()}>Try again</button></div>}
    {loading && <p role="status">Loading your notes…</p>}
    {!loading&&!error&&!items.length&&!next&&<p>You have not saved any notes yet. Open a lesson and use “Notes, bookmark and achievement record” to add one.</p>}
    <div className="learner-notes-list">{items.map(item=><article key={`${item.courseCode}:${item.noteKey}`}><p className="learner-notes-eyebrow">{item.courseTitle} · {item.courseCode}</p><h3>{item.label}</h3><p className="learner-notes-content">{item.note}</p><a href={item.materialId ? `/learn/${encodeURIComponent(item.courseCode)}/${encodeURIComponent(item.materialId)}?view=notes` : `/learn/${encodeURIComponent(item.courseCode)}?view=${item.noteKey === "note:course" ? "course-notes" : "overview"}`}>{item.materialId ? "Open lesson and edit note" : item.noteKey === "note:course" ? "Edit course notes" : "Open course"}</a></article>)}</div>
    {next!==null && <button disabled={loading} onClick={()=>void load(next)}>Load more notes</button>}
  </section>;
}
