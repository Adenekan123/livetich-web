import { notFound } from 'next/navigation';
import { RecorderView } from './recorder-view';

/**
 * What LiveKit's headless browser opens to film a class.
 *
 * Not a page for people. It renders the lesson the way a student sees it —
 * board, mushaf, shared media, the instructor's camera — and nothing else: no
 * controls, no chat, no roster, and none of the instructor's private panels.
 * A recording gets shared, so anything on this page is something everyone who
 * receives the link will see.
 */
export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; api?: string }>;
}) {
  const { id } = await params;
  const { t, api } = await searchParams;
  // Without a recorder token there is nothing to authorise this view at all.
  if (!t) notFound();
  // Which packs are on comes back with the recorder context, not from
  // /organizations/plugins: that endpoint refuses recorder tokens outright, and
  // the client helper turns the refusal into "no packs" — which unmounts the
  // mushaf and the shared editor without a word.
  return <RecorderView sessionId={id} token={t} apiBase={api} />;
}
