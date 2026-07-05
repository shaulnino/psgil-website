import { redirect } from "next/navigation";

/**
 * Account administration moved out of the steward module (Identity v2) to the
 * platform admin console under "My Account". This route is kept only to
 * redirect any old links/bookmarks.
 */
export default function StewardAdminRedirect() {
  redirect("/admin");
}
