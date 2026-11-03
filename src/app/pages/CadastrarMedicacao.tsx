import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Beaker, Boxes, Pill, Tablets, X } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Chip } from "../components/Chip";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { SelectField } from "../components/SelectField";
import { TextField } from "../components/TextField";
import {
  ALLOWED_UNITS,
  ALLOWS_FRACTION,
  FORM_OPTIONS,
  STOCK_UNIT_LABELS,
  UNIT_LABELS,
  loadDraft,
  parseDecimal,
  saveDraft,
} from "../lib/medicationOptions";
import {
  medicationService,
  type CatalogItem,
  type DosageUnit,
  type MedicationForm,
} from "../../services/medications";
import { getApiErrorMessage } from "../../services/errors";

export function CadastrarMedicacao() {
  const navigate = useNavigate();
  // Resume a draft when coming back from "Quando tomar?"
  const [draft] = useState(loadDraft);

  const [search, setSearch] = useState(draft?.name ?? "");
  const [selected, setSelected] = useState<CatalogItem | null>(draft?.catalogItem ?? null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [form, setForm] = useState<MedicationForm>(draft?.form ?? "TABLET");
  const [doseAmount, setDoseAmount] = useState(draft ? String(draft.dosageAmount) : "");
  const [doseUnit, setDoseUnit] = useState<DosageUnit>(draft?.dosageUnit ?? "PILULA");
  const [quantity, setQuantity] = useState(
    draft?.currentStock !== undefined ? String(draft.currentStock) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const allowedUnits = selected ? selected.uiConfig.allowedUnits : ALLOWED_UNITS[form];

  // Catalog autocomplete (debounced). Empty search lists the first suggestions.
  useEffect(() => {
    if (selected) return;
    let ignore = false;
    const handle = window.setTimeout(() => {
      medicationService
        .searchCatalog(search.trim())
        .then((items) => {
          if (ignore) return;
          setCatalog(items);
          setCatalogError(null);
        })
        .catch((err: unknown) => {
          if (!ignore) {
            setCatalogError(getApiErrorMessage(err, "Não foi possível carregar o catálogo."));
          }
        });
    }, 300);
    return () => {
      ignore = true;
      window.clearTimeout(handle);
    };
  }, [search, selected]);

  const selectItem = (item: CatalogItem) => {
    setSelected(item);
    setSearch(item.name);
    setForm(item.form);
    setDoseUnit(item.defaultUnit);
    setError(null);
  };

  const clearSelection = () => {
    setSelected(null);
    setSearch("");
  };

  const changeForm = (next: MedicationForm) => {
    setForm(next);
    if (!ALLOWED_UNITS[next].includes(doseUnit)) setDoseUnit(ALLOWED_UNITS[next][0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const name = selected ? selected.name : search.trim();
    if (!name) {
      setError("Informe o nome do medicamento ou escolha uma sugestão do catálogo.");
      return;
    }

    const amount = parseDecimal(doseAmount);
    if (!(amount > 0)) {
      setError("Informe a dosagem: um número maior que zero (ex.: 1 ou 500).");
      return;
    }

    const allowsFraction = selected ? selected.allowsSplitting : ALLOWS_FRACTION[form];
    if (!allowsFraction && doseUnit === "PILULA" && !Number.isInteger(amount)) {
      setError("Este medicamento não pode ser partido. Informe uma dosagem inteira (ex.: 1, 2).");
      return;
    }

    let currentStock: number | undefined;
    if (quantity.trim()) {
      currentStock = parseDecimal(quantity);
      if (!(currentStock >= 0)) {
        setError("A quantidade em estoque deve ser um número (ex.: 30).");
        return;
      }
    }

    saveDraft({
      catalogItem: selected ?? undefined,
      name,
      form: selected ? selected.form : form,
      dosageAmount: amount,
      dosageUnit: doseUnit,
      currentStock,
    });
    navigate("/app/cadastrar/quando-tomar");
  };

  const query = search.trim();

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto lg:max-w-3xl">
      <PageHeader
        title="Cadastrar medicação"
        subtitle="Adicione um novo medicamento ao sistema."
        backTo="/app/medicamentos"
      />

      <div className="space-y-5">
        <Card
          icon={Pill}
          title="Pesquisar medicamento"
          subtitle="Busque pelo nome do princípio ativo ou apelido."
        >
          {selected ? (
            <div className="flex items-start justify-between gap-3 rounded-xl bg-sage/50 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-heading">{selected.name}</p>
                {selected.activeIngredient && (
                  <p className="text-sm text-muted">
                    {selected.activeIngredient}
                    {selected.concentration && ` · ${selected.concentration}`}
                  </p>
                )}
                {selected.defaultInstructions && (
                  <p className="mt-1 text-sm text-muted">{selected.defaultInstructions}</p>
                )}
              </div>
              <Button
                variant="ghost"
                className="shrink-0 px-3 py-2"
                leftIcon={<X size={16} />}
                onClick={clearSelection}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Digite o nome do princípio ativo ou apelido..."
                aria-label="Pesquisar medicamento"
                className="max-w-lg"
              />
              <p className="mt-4 text-sm font-medium text-heading">
                {query ? "Encontrados no catálogo" : "Sugestões"}
              </p>
              {catalogError ? (
                <p className="mt-2 text-sm text-danger">{catalogError}</p>
              ) : catalog.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {catalog.map((item) => (
                    <Chip key={item.id} variant="soft" onClick={() => selectItem(item)}>
                      {item.name}
                    </Chip>
                  ))}
                </div>
              ) : (
                query && (
                  <p className="mt-2 text-sm text-muted">
                    Nada encontrado no catálogo. Você pode cadastrar “{query}” manualmente:
                    escolha o tipo e a dosagem abaixo.
                  </p>
                )
              )}
            </>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card
            icon={Tablets}
            title="Tipo de medicamento"
            subtitle={
              selected ? "Definido pelo catálogo." : "Selecione o tipo de apresentação."
            }
          >
            <SelectField
              value={selected ? selected.form : form}
              onChange={(e) => changeForm(e.target.value as MedicationForm)}
              disabled={Boolean(selected)}
              aria-label="Tipo de medicamento"
            >
              {FORM_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </Card>

          <Card icon={Beaker} title="Dosagem" subtitle="Quanto tomar em cada dose.">
            <div className="flex gap-3">
              <TextField
                inputMode="decimal"
                placeholder="Ex.: 1"
                value={doseAmount}
                onChange={(e) => setDoseAmount(e.target.value)}
                aria-label="Dosagem"
                className="flex-none basis-28"
              />
              <SelectField
                value={doseUnit}
                onChange={(e) => setDoseUnit(e.target.value as DosageUnit)}
                aria-label="Unidade da dosagem"
                containerClassName="flex-1"
              >
                {allowedUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABELS[unit]}
                  </option>
                ))}
              </SelectField>
            </div>
          </Card>
        </div>

        <Card
          icon={Boxes}
          title="Quantidade em estoque"
          subtitle="Quanto você tem em casa agora. Usado para avisar quando estiver acabando."
        >
          <div className="flex items-center gap-3">
            <TextField
              inputMode="numeric"
              placeholder="Ex.: 30"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label="Quantidade em estoque"
              className="flex-none basis-28"
            />
            <span className="w-40 shrink-0 text-muted">
              {STOCK_UNIT_LABELS[selected ? selected.form : form]}
            </span>
          </div>
        </Card>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth rightIcon={<ArrowRight size={20} />}>
          Continuar
        </Button>
      </div>
    </form>
  );
}
