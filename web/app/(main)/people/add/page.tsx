import { redirect } from "next/navigation";

/** Deep link target — opens add-contact sheet on /people via ?add=1 */
export default function AddPersonPage() {
  redirect("/people?add=1");
}
