import LearningPage from "@/components/learning-page";

type LearningSearch = { courseCode?: string | string[]; lesson?: string | string[] };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";

export default async function LearnerCoursePage({ searchParams }: { searchParams: Promise<LearningSearch> }) {
  const query = await searchParams;
  return <LearningPage courseCode={first(query.courseCode)} lessonId={first(query.lesson).split("/")[0]} />;
}
