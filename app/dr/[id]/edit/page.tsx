// Edit an OPEN delivery receipt: change the header fields and replace its line
// items, then save via updateDRAction (which deletes + reinserts the lines, matching
// fastrak's edit-then-save semantics). A posted or cancelled DR is frozen — this
// page redirects back to the read-only view in that case. Server component; the
// dynamic line rows live in the DRLineEditor client component, seeded with the
// existing lines.
import { notFound, redirect } from "next/navigation";
import { getDR } from "@/lib/dr";
import { listCustomers } from "@/lib/customers";
import { listItems } from "@/lib/items";
import { updateDRAction } from "../../actions";
import { Field, FormActions, FormCard } from "../../../reference-ui";
import { SelectField, DateField, type Option } from "../../../inventory/movement-ui";
import { DRLineEditor, type DRItemOption, type DRLineInitial } from "../../dr-lines";
import { DraftForm } from "../../../_components/draft-form";

export const dynamic = "force-dynamic";

export default async function EditDRPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dr = await getDR(id);
  if (!dr) notFound();
  if (dr.posted || dr.cancelled) redirect(`/dr/${dr.id}`);

  const [customers, items] = await Promise.all([listCustomers(), listItems()]);

  const customerOptions: Option[] = customers.map((c) => ({
    value: c.id,
    label: c.name ?? c.id
  }));
  const itemOptions: DRItemOption[] = items.map((it) => ({
    value: it.id,
    label: it.code ? `${it.code} — ${it.description ?? ""}`.trim() : it.id,
    unit: it.unit,
    price: it.price,
    pack: it.pack_size
  }));

  const initial: DRLineInitial[] = dr.lines.map((l) => ({
    itemId: l.item_id ?? "",
    qty: String(l.qty),
    pcs: String(l.qty2),
    price: l.price ?? "",
    disc: l.disc ?? "",
    disc2: l.disc2 ?? "",
    unit: l.unit ?? ""
  }));

  const action = updateDRAction.bind(null, dr.id);

  return (
    <main>
      <div className="crumb">
        <a href="/">← Project Kenny</a> /{" "}
        <a href="/dr">delivery receipts</a> /{" "}
        <a href={`/dr/${dr.id}`}>{dr.dr_no ?? dr.id}</a> / edit
      </div>
      <div className="kicker">fastrak module</div>
      <h1>Edit delivery receipt</h1>

      <FormCard>
        <DraftForm draftKey={`dr:${dr.id}`} action={action}>
          <Field label="DR number" name="dr_no" maxLength={25} defaultValue={dr.dr_no} autoFocus />
          <DateField label="Date" name="dr_date" defaultValue={dr.dr_date} />
          <SelectField
            label="Customer"
            name="customer_id"
            options={customerOptions}
            defaultValue={dr.customer_id}
            placeholder="— select a customer —"
          />
          <Field label="Ship-to address" name="address" maxLength={200} defaultValue={dr.address} />
          <Field label="Customer PO no." name="po_no" maxLength={25} defaultValue={dr.po_no} />
          <Field label="Terms (days)" name="terms_days" type="number" defaultValue={dr.terms_days} />
          <Field label="Document discount %" name="doc_disc" type="number" defaultValue={dr.doc_disc} />
          <Field label="Add-on %" name="add_pct" type="number" defaultValue={dr.add_pct} />
          <Field label="Remarks" name="remarks" maxLength={150} defaultValue={dr.remarks} />
          <DRLineEditor items={itemOptions} initial={initial} />
          <FormActions submitLabel="Save changes" cancelHref={`/dr/${dr.id}`} />
        </DraftForm>
      </FormCard>
    </main>
  );
}
