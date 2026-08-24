import HabitApp from "../../habit-app";

export default async function RoutineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HabitApp initialView="routineDetail" initialEntityId={id} />;
}
