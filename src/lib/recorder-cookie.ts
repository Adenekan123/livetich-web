/**
 * Where the recording browser keeps its token so same-origin file requests can
 * carry it.
 *
 * An <img>, <embed> or <video> cannot send an Authorization header, so board
 * images and PDFs are fetched through the /api/files proxy, which normally
 * reads the session cookie. A recorder has no session — only the token from
 * its URL — so it parks that here for the proxy to find.
 *
 * Deliberately not the session cookie's name: this is a strictly weaker
 * credential and must never be mistaken for a logged-in user.
 */
export const RECORDER_COOKIE = 'livetich_recorder';
