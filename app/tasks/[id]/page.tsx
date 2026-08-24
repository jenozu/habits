import HabitApp from "../../habit-app";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HabitApp initialView="taskDetail" initialEntityId={id} />;
}
