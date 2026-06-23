// The shared field set for the item create/edit forms. Loads the reference
// data (categories, brands, suppliers, units) and renders the dropdown pickers
// alongside the plain text/number fields. Used by both /items/new and
// /items/[id]. Server component.
import { listCategories } from "@/lib/categories";
import { listBrands } from "@/lib/brands";
import { listSuppliers } from "@/lib/suppliers";
import { listUnits } from "@/lib/units";
import type { Item } from "@/lib/items";
import { Field } from "../reference-ui";
import { SelectField, type Option } from "./item-ui";

export async function ItemFormFields({ item }: { item?: Item }) {
  const [categories, brands, suppliers, units] = await Promise.all([
    listCategories(),
    listBrands(),
    listSuppliers(),
    listUnits()
  ]);

  const categoryOptions: Option[] = categories.map((c) => ({
    value: c.id,
    label: c.category ?? c.id
  }));
  const brandOptions: Option[] = brands.map((b) => ({
    value: b.id,
    label: b.brand ?? b.id
  }));
  const supplierOptions: Option[] = suppliers.map((s) => ({
    value: s.id,
    label: s.name ?? s.id
  }));
  // Units are stored on the item as their text value (e.g. "BOX"), not an id —
  // so the picker's value is the unit label itself.
  const unitOptions: Option[] = units
    .filter((u) => u.unit)
    .map((u) => ({ value: u.unit as string, label: u.unit as string }));

  return (
    <>
      <Field
        label="Code"
        name="code"
        required
        maxLength={100}
        defaultValue={item?.code}
        autoFocus
      />
      <Field
        label="Description"
        name="description"
        maxLength={150}
        defaultValue={item?.description}
      />
      <SelectField
        label="Unit"
        name="unit"
        options={unitOptions}
        defaultValue={item?.unit}
      />
      <SelectField
        label="Alternate unit"
        name="unit2"
        options={unitOptions}
        defaultValue={item?.unit2}
      />
      <Field
        label="Pack size"
        name="pack_size"
        type="number"
        defaultValue={item?.pack_size}
      />
      <Field
        label="Base cost"
        name="base_cost"
        type="number"
        defaultValue={item?.base_cost}
      />
      <Field
        label="Selling price"
        name="price"
        type="number"
        defaultValue={item?.price}
      />
      <Field
        label="Retail price"
        name="retail"
        type="number"
        defaultValue={item?.retail}
      />
      <SelectField
        label="Category"
        name="category_id"
        options={categoryOptions}
        defaultValue={item?.category_id}
      />
      <SelectField
        label="Brand"
        name="brand_id"
        options={brandOptions}
        defaultValue={item?.brand_id}
      />
      <SelectField
        label="Supplier"
        name="supplier_id"
        options={supplierOptions}
        defaultValue={item?.supplier_id}
      />
      <Field
        label="Critical (reorder) level"
        name="critical"
        type="number"
        defaultValue={item?.critical}
      />
      <SelectField
        label="Type"
        name="type"
        options={[
          { value: "Import", label: "Import" },
          { value: "Local", label: "Local" }
        ]}
        defaultValue={item?.type}
      />
      <label
        style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}
      >
        <input
          type="checkbox"
          name="inactive"
          value="1"
          defaultChecked={item?.inactive ?? false}
        />
        <span style={{ fontSize: 14 }}>Inactive (hidden from selling)</span>
      </label>
    </>
  );
}
