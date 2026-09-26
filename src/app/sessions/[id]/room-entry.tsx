'use client';

/**
 * The door in front of the classroom.
 *
 * `ClassRoom` is only mounted once someone has pressed Join, which is the point
 * of a prejoin screen rather than a decoration on top of one: no LiveKit
 * connection, no socket, no attendance, and no camera published while a student
 * is still deciding which headset they are on.
 *
 * Everyone passes through, instructors included. They are the one participant
 * whose dead microphone wastes the whole room's time, and from the second class
 * onward the devices are already remembered, so it is one button.
 */

import { useState } from 'react';
import type { RoomUser } from '@/lib/realtime-contract';
import { ClassRoom } from './class-room';
import { PreJoin } from './prejoin';

export function RoomEntry({
  sessionId,
  courseId,
  courseTitle,
  me,
  teaching,
  live,
  islamicEducation,
  codeInstruction,
  mathsSciences,
  testPrep,
}: {
  sessionId: string;
  courseId: string;
  courseTitle: string;
  me: RoomUser;
  teaching: boolean;
  live: boolean;
  islamicEducation: boolean;
  codeInstruction: boolean;
  mathsSciences: boolean;
  testPrep: boolean;
}) {
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <PreJoin
        courseTitle={courseTitle}
        displayName={me.name}
        live={live}
        teaching={teaching}
        onJoin={() => setJoined(true)}
      />
    );
  }

  return (
    <ClassRoom
      sessionId={sessionId}
      courseId={courseId}
      courseTitle={courseTitle}
      me={me}
      teaching={teaching}
      islamicEducation={islamicEducation}
      codeInstruction={codeInstruction}
      mathsSciences={mathsSciences}
      testPrep={testPrep}
    />
  );
}
