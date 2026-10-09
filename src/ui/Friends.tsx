import { useEffect, useState } from "react";
import { cardIsToday, friendCard, kfmt, parseInviteCode, POKES, type FriendCard } from "../training";
import type { Invite } from "../sync/social";
import { useApp } from "./app-state";
import { ConfirmButton } from "./cards";
import { Icon } from "./icons";
import { Grow } from "./motion";
import { Avatar, GoogleButton, useSync } from "./SyncSection";
import {
  addFriendByCode, clearPendingInvite, dismissPoke, inviteLink, loadInviteCode, lookUpInvite, markPokesSeen, pendingInvite, poke, pokesLeft, unfriend, useFriends,
  type Card,
} from "./friendsStore";

const face = (uid: string, c: Pick<FriendCard, "name" | "photo"> | null | undefined) => ({ uid, email: null, name: c?.name ?? "?", photo: c?.photo ?? null });
const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Done, not yet, or a rest day, for today. A card from an earlier day means not yet. */
function status(c: FriendCard | null | undefined, today: Date): "done" | "rest" | "notyet" | "unknown" {
  if (!c) return "unknown";
  if (!cardIsToday(c, today)) return "notyet";
  return c.today.rest ? "rest" : c.today.done ? "done" : "notyet";
}
const STATUS_TXT = { done: "Done ✓", rest: "Rest day", notyet: "Not yet", unknown: "…" };

function StatusPill({ s }: { s: ReturnType<typeof status> }) {
  return <span className={"fpill " + s}>{STATUS_TXT[s]}</span>;
}

/** The friends sheet: you, pokes, your friends, and adding one. */
export function FriendsSheetBody() {
  const { model, state, openSheet } = useApp();
  const sync = useSync();
  const f = useFriends();
  const acct = sync.phase !== "off" ? sync.account : null;
  useEffect(() => { markPokesSeen(); }, [f.pokes.length]);

  if (!acct) return (
    <div className="fr">
      <p className="setnote">Add friends to see each other's streaks and whether today's session is done. Then poke them. Nicely, mostly.</p>
      <p className="setnote">Friends only see your first name, photo, streak, today's session and totals. Never your logs or weight.</p>
      <GoogleButton label="Sign in to add friends" busy={sync.phase === "starting"} />
      {sync.error && <p className="syncerr" role="alert">{sync.error}</p>}
    </div>
  );

  const me = friendCard(model, { name: state.settings.name || acct.name || "", photo: acct.photo ?? null });
  const sorted = [...f.ids].sort((a, b) => (f.cards[b]?.streak ?? -1) - (f.cards[a]?.streak ?? -1));
  return (
    <div className="fr">
      <PendingInvite />
      <section className="frme">
        <Avatar account={face(acct.uid, me)} size={52} />
        <div className="frme-txt">
          <b>{me.name} <small>(you)</small></b>
          <span>{me.today.rest ? "Rest day today" : `${me.today.title}: ${me.today.done ? "done" : "not yet"}`}</span>
        </div>
        <span className="frstreak"><Icon.flame /><b>{me.streak}</b></span>
      </section>
      <div className="frmestats">
        <div><b>{me.week.done}/{me.week.total}</b><small>This week</small></div>
        <div><b>{kfmt(me.totals.steps)}</b><small>Steps</small></div>
        <div><b>{me.totals.miles.toFixed(1)}</b><small>Miles</small></div>
      </div>

      {f.pokes.length > 0 && (
        <section className="frsec">
          <h3 className="lbl">Pokes</h3>
          {f.pokes.slice(0, 5).map((p) => (
            <div key={p.id} className={"frpoke " + p.kind}>
              <Avatar account={face(p.from, p)} size={34} />
              <div className="rtx"><b>{p.name}</b><small>{p.msg} · {ago(p.at)}</small></div>
              {f.ids.includes(p.from) && <button className="chip" onClick={() => openSheet({ kind: "friend", uid: p.from })}>Poke back</button>}
              <button className="xbtn" aria-label="Dismiss" onClick={() => dismissPoke(p.id)}>&times;</button>
            </div>
          ))}
        </section>
      )}

      <section className="frsec">
        <h3 className="lbl">Friends{f.ids.length ? ` (${f.ids.length})` : ""}</h3>
        {f.error && <p className="syncerr">{f.error}</p>}
        {!f.ids.length && !f.error && <p className="setnote">No friends yet. Share your code below, or add theirs.</p>}
        {sorted.map((id) => {
          const c = f.cards[id], s = status(c, model.today);
          return (
            <button key={id} className="frrow" onClick={() => openSheet({ kind: "friend", uid: id })}>
              <Avatar account={face(id, c)} size={40} />
              <span className="rtx"><b>{c?.name ?? "Friend"}</b><small>{c ? (c.today.rest ? "Rest day" : c.today.title) : "Hasn't opened the app yet"}</small></span>
              <span className="frstreak small"><Icon.flame /><b>{c?.streak ?? 0}</b></span>
              <StatusPill s={s} />
            </button>
          );
        })}
      </section>

      <AddFriend />
    </div>
  );
}

function PendingInvite() {
  const f = useFriends();
  const [inv, setInv] = useState<(Invite & { code: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const raw = pendingInvite(), code = raw && parseInviteCode(raw);
    if (!code) { clearPendingInvite(); return; }
    lookUpInvite(code).then((i) => { if (i && i.uid !== f.uid && !f.ids.includes(i.uid)) setInv({ ...i, code }); else clearPendingInvite(); }).catch(() => {});
  }, [f.uid, f.ids]);
  if (!inv) return null;
  return (
    <section className="frinvite">
      <Avatar account={face(inv.uid, inv)} size={44} />
      <div className="rtx"><b>{inv.name} invited you</b><small>Add each other as friends?</small></div>
      <span className="btnpair">
        <button className="chip use" disabled={busy} onClick={async () => { setBusy(true); try { await addFriendByCode(inv.code, inv.uid); } finally { clearPendingInvite(); setInv(null); setBusy(false); } }}>Add</button>
        <button className="chip" onClick={() => { clearPendingInvite(); setInv(null); }}>No thanks</button>
      </span>
    </section>
  );
}

function AddFriend() {
  const { state, toast } = useApp();
  const sync = useSync();
  const f = useFriends();
  const [code, setCode] = useState<string | null>(f.code);
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<(Invite & { code: string }) | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const acct = sync.account;
  useEffect(() => {
    if (!acct) return;
    loadInviteCode(acct, state.settings.name || acct.name || "").then(setCode).catch(() => setMsg("Couldn't make your invite code. Check your connection."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acct?.uid]);

  const share = async () => {
    if (!code) return;
    const url = inviteLink(code), text = `Train with me on Not a Runner. My friend code is ${code}.`;
    try {
      if (navigator.share) { await navigator.share({ title: "Not a Runner", text, url }); return; }
    } catch { /* closed the share sheet */ return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Invite link copied"); } catch { toast(`Your code is ${code}`); }
  };
  const find = async () => {
    const c = parseInviteCode(typed);
    setFound(null); setMsg(null);
    if (!c) { setMsg("Codes are 8 letters and numbers."); return; }
    if (c === code) { setMsg("That's your own code."); return; }
    setBusy(true);
    try {
      const i = await lookUpInvite(c);
      if (!i) setMsg("No one has that code. Check it and try again.");
      else if (f.ids.includes(i.uid)) setMsg(`You and ${i.name} are already friends.`);
      else setFound({ ...i, code: c });
    } catch { setMsg("Couldn't check that code. Check your connection."); }
    setBusy(false);
  };
  const add = async () => {
    if (!found) return;
    setBusy(true);
    try { await addFriendByCode(found.code, found.uid); toast(`You and ${found.name} are friends now`); setFound(null); setTyped(""); }
    catch { setMsg("Couldn't add them. Try again."); }
    setBusy(false);
  };

  return (
    <section className="frsec fradd">
      <h3 className="lbl">Add a friend</h3>
      <div className="frcode">
        <div><small>Your code</small><b>{code ? `${code.slice(0, 4)} ${code.slice(4)}` : "…"}</b></div>
        <button className="btn solid" disabled={!code} onClick={share}>Share invite</button>
      </div>
      <div className="frenter">
        <input className="xt" placeholder="Friend's code" maxLength={60} value={typed} onChange={(e) => { setTyped(e.target.value); setFound(null); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") find(); }} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        <button className="chip" disabled={busy || !typed.trim()} onClick={find}>Find</button>
      </div>
      {found && (
        <div className="frfound">
          <Avatar account={face(found.uid, found)} size={40} />
          <div className="rtx"><b>{found.name}</b><small>Add as a friend?</small></div>
          <button className="chip use" disabled={busy} onClick={add}>Add</button>
        </div>
      )}
      {msg && <p className="setnote">{msg}</p>}
    </section>
  );
}

/** One friend, bigger: their streak, today, week and totals, and pokes. */
export function FriendSheetBody({ uid }: { uid: string }) {
  const { model, state, closeSheet, toast } = useApp();
  const sync = useSync();
  const f = useFriends();
  const c: Card | null | undefined = f.cards[uid];
  const [, bump] = useState(0);
  if (!f.ids.includes(uid) && f.uid) return <p className="setnote">You're not friends anymore.</p>;
  if (!c) return <p className="setnote">{c === null ? "They haven't opened the app since you became friends. Their card shows up once they do." : "Loading…"}</p>;
  const s = status(c, model.today);
  const kind = s === "done" || s === "rest" ? "cheer" : "tease";
  const left = pokesLeft(uid);
  const me = { name: (state.settings.name || sync.account?.name || "Friend").trim().split(/\s+/)[0], photo: sync.account?.photo ?? null };
  const send = async (msg: string) => {
    try { if (await poke(uid, kind, msg, me)) toast(kind === "cheer" ? "Cheer sent" : "Poke sent"); }
    catch { toast("Couldn't send. Check your connection."); }
    bump((n) => n + 1);
  };
  const wpct = c.week.total ? Math.round(100 * c.week.done / c.week.total) : 0;
  return (
    <div className="fr frbig">
      <div className="frhead">
        <Avatar account={face(uid, c)} size={84} />
        <div>
          <small>{c.plan.daysToRace !== null ? `${c.plan.daysToRace} days to ${c.plan.name}` : c.plan.name}</small>
        </div>
      </div>
      <div className="frbigstreak">
        <div><span className="num"><Icon.flame />{c.streak}</span><small>Week streak</small></div>
        <div><span className="num">{c.best}</span><small>Best</small></div>
      </div>
      <section className={"frtoday " + s}>
        <span className="lbl">Today</span>
        <b>{s === "notyet" && !cardIsToday(c, model.today) ? "Hasn't opened the app yet today" : c.today.rest ? "Rest day" : c.today.title}</b>
        <StatusPill s={s} />
      </section>
      <div className="frweek">
        <div className="btop"><b>This week</b><small>{c.week.done} of {c.week.total} cardio sessions</small></div>
        <span className="bbar"><Grow pct={wpct} /></span>
      </div>
      <div className="frmestats">
        <div><b>{kfmt(c.totals.steps)}</b><small>Steps</small></div>
        <div><b>{c.totals.miles.toFixed(1)}</b><small>Miles</small></div>
        <div><b>{c.totals.hours.toFixed(1)}</b><small>Hours</small></div>
      </div>

      <section className="frsec">
        <h3 className="lbl">{kind === "cheer" ? "Cheer them on" : "Give them a poke"}</h3>
        <div className="frpokes">
          {POKES[kind].map((m) => <button key={m} className={"frpokebtn " + kind} disabled={!left} onClick={() => send(m)}>{m}</button>)}
        </div>
        <p className="setnote">{left ? `${left} left today` : "That's plenty for today. Try again tomorrow."}</p>
      </section>
      <p className="setnote">Updated {ago(c.updatedAt)}.</p>
      <ConfirmButton className="btn small" label="Remove friend" confirmLabel={`Remove ${c.name}?`} onConfirm={async () => { await unfriend(uid).catch(() => {}); closeSheet(); }} />
    </div>
  );
}
