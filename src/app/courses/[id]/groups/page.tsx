import { redirect } from 'next/navigation';

/** Groups now live inside the Assignment Lab's "Groups" tab. Redirect any old
 *  links or bookmarks there. */
export default async function GroupsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/courses/${id}/assignments`);
}
