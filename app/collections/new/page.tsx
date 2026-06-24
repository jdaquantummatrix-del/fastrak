// Record a Collection: pick the paying customer, then apply the payment across that
// customer's outstanding A/R rows (see the CollectionForm client component, which
// filters the receivables to the chosen customer and pre-fills each amount to the full
// balance). Submits to createCollectionAction. Server component — it loads the customer
// list and every open receivable (a positive-balance ar row) for the form to filter.
import { listCustomers } from "@/lib/customers";
import { listAR } from "@/lib/ar";
import { CollectionForm, type OpenAR, type CustomerOption } from "../collection-form";
import { FormCard } from "../../reference-ui";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  const [customers, ar] = await Promise.all([listCustomers(), listAR()]);

  const customerOptions: CustomerOption[] = customers.map((c) => ({
    value: c.id,
    label: c.name ?? c.id
  }));

  // Only rows with a positive outstanding balance can be paid down.
  const openAR: OpenAR[] = ar
    .filter((a) => Number(a.amount) > 0)
    .map((a) => ({
      id: a.id,
      customer_id: a.customer_id,
      dr_no: a.dr_no,
      due_date: a.due_date,
      amount: a.amount
    }));

  return (
    <main>
      <div className="crumb">
        <a href="/">← fastrak</a> / <a href="/collections">collections</a> / new
      </div>
      <div className="kicker">fastrak module</div>
      <h1>New collection</h1>

      <FormCard>
        <CollectionForm customers={customerOptions} openAR={openAR} />
      </FormCard>
    </main>
  );
}
