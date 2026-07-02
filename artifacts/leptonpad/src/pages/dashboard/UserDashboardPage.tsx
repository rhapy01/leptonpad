import { Redirect } from "wouter";

/** Legacy route — collection lives at /collections */
export default function UserDashboardPage() {
  return <Redirect to="/collections" />;
}
