import "server-only";
import { q } from "./db";
import { EVENT } from "./event";
import { ageOn } from "./age";

/**
 * 현황판이 쓰는 데이터 한 벌.
 *
 * 서버 컴포넌트(첫 화면)와 API(30초 갱신)가 **같은 함수를 쓴다.**
 * 두 곳에 따로 쿼리를 두면 화면이 새로고침 전후로 달라 보인다.
 */

const CAP: number = EVENT.capacityPerGender;

export type AdminRow = {
  id: string; seq: number; name: string; phone: string;
  gender: "M" | "F"; birth: string; age: number; ageFlag: boolean;
  marital: string | null; job: string | null; status: string; nick: string | null;
  depositor_name: string | null; due_at: string | null; hours_left: number | null;
  submitted: boolean; paid: boolean; memo: string | null;
};

export type Counts = Record<string, { M: number; F: number }>;

export async function loadBoard(): Promise<{ counts: Counts; items: AdminRow[] }> {
  const rows = await q<Record<string, unknown>>(
    `select a.id, a.seq, a.name, a.phone, a.gender, a.birth::text as birth,
            a.marital, a.job, a.status, a.depositor_name, a.memo,
            a.due_at::text as due_at,
            (a.submitted_at is not null) as submitted,
            p.nick,
            (pay.id is not null) as paid
       from applicant a
       left join participant p on p.applicant_id = a.id
       left join payment pay on pay.applicant_id = a.id and pay.refunded_at is null
      order by a.seq`,
  );

  const now = Date.now();
  const items: AdminRow[] = rows.map((r) => {
    const birth = String(r.birth);
    const age = ageOn(birth);
    const due = r.due_at ? new Date(String(r.due_at)) : null;
    return {
      id: String(r.id), seq: Number(r.seq), name: String(r.name), phone: String(r.phone),
      gender: r.gender as "M" | "F", birth, age,
      // 🟡 서버가 나이로 막지 않기 때문에 여기서 사람이 보게 띄운다.
      ageFlag: age < EVENT.ageMin || age > EVENT.ageMax,
      marital: (r.marital as string) ?? null,
      job: (r.job as string) ?? null,
      status: String(r.status),
      nick: (r.nick as string) ?? null,
      depositor_name: (r.depositor_name as string) ?? null,
      due_at: due ? due.toISOString() : null,
      hours_left: due ? Math.round(((due.getTime() - now) / 3_600_000) * 10) / 10 : null,
      submitted: Boolean(r.submitted), paid: Boolean(r.paid),
      memo: (r.memo as string) ?? null,
    };
  });

  const by = (status: string, g: "M" | "F") =>
    items.filter((i) => i.status === status && i.gender === g).length;

  // 🔴 `remaining`을 서버가 계산해서 내려준다. 운영자가 머릿속으로 세면 반드시 틀린다.
  const counts: Counts = {
    confirmed: { M: by("confirmed", "M"), F: by("confirmed", "F") },
    awaiting_payment: { M: by("awaiting_payment", "M"), F: by("awaiting_payment", "F") },
    pre_registered: { M: by("pre_registered", "M"), F: by("pre_registered", "F") },
    waitlist: { M: by("waitlist", "M"), F: by("waitlist", "F") },
    remaining: {
      M: Math.max(0, CAP - by("confirmed", "M")),
      F: Math.max(0, CAP - by("confirmed", "F")),
    },
  };

  return { counts, items };
}
