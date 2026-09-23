import Link from "next/link";
import { Subgroup } from "@/lib/api";
import AppIcon from "./AppIcon";

export default function SubgroupStudyAction({ subgroup, from }: {
  subgroup: Subgroup;
  from: "library" | "group";
}) {
  const { pending, active, attention, learned, reviewable } = subgroup.stats;
  const available = (reviewable ?? Math.max(0, active - attention)) > 0;
  return <div className="subgroup-study-action">
    <span className={`subgroup-study-status${pending ? " has-due" : ""}`}>
      {pending ? `${pending} para revisar` : available ? "Revisão em dia" : attention ? "Cards precisam de ajuste" : learned ? "Tudo aprendido" : "Sem cards"}
    </span>
    {(pending > 0 || available) && <Link
      className={`button small ${pending ? "primary" : "secondary"}`}
      aria-label={`${pending ? "Revisar" : "Praticar"} ${subgroup.title}`}
      href={`/review/${subgroup.id}?from=${from}${pending ? "" : "&all=1"}`}
    ><AppIcon name="review" />{pending ? "Revisar" : "Praticar"}</Link>}
  </div>;
}
