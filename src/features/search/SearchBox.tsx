import { useId, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button, TextInput } from "@/shared/ui/primitives";

import { useSuggestions } from "./hooks";

const KIND_LABEL = { card: "ficha", synonym: "sinônimo", glossary: "termo do glossário" } as const;

/** Campo de busca com sugestões (padrão combobox acessível: setas, Enter e Esc). */
export function SearchBox({ initialValue, onSubmit }: { initialValue: string; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useSuggestions(value);
  const items = open ? (suggestions.data ?? []) : [];
  const listId = useId();

  const choose = (label: string) => {
    setValue(label);
    setOpen(false);
    setActive(-1);
    onSubmit(label);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setOpen(false);
    onSubmit(value.trim());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(items[active]!.label);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <form className="search-bar" role="search" onSubmit={submit}>
      <div className="search-box">
        <label htmlFor={`${listId}-input`} className="visually-hidden">
          Buscar no catálogo
        </label>
        <TextInput
          id={`${listId}-input`}
          size="lg"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Descreva o que você procura, do seu jeito. Ex.: vendas por região, clientes, metas…"
          autoComplete="off"
          autoFocus
        />
        {items.length ? (
          <ul id={listId} role="listbox" className="suggestions" aria-label="Sugestões">
            {items.map((item, index) => (
              <li
                key={`${item.kind}-${item.label}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? "suggestion suggestion--active" : "suggestion"}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item.label);
                }}
              >
                <span>{item.label}</span>
                <span className="xsmall muted">{KIND_LABEL[item.kind]}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button type="submit" variant="primary" disabled={value.trim().length < 2}>
        Buscar
      </Button>
    </form>
  );
}
