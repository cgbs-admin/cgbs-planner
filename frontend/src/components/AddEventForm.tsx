import React, { Fragment, useEffect, useMemo, useState } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { apiFetch } from "../api";

type Category = {
  id: number;
  name: string;
  description?: string | null;
  color_hex?: string | null;
  symbol?: string | null;
};

type PlanningLevel = {
  id: number;
  name: string;
};

type EventForSelect = {
  id: number;
  title: string;
};

type EventForEdit = {
  id: number;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  preacher?: string | null;
  sermon_title?: string | null;
  remarks?: string | null;
  internal_notes?: string | null;
  clarification?: string | null;
  link?: string | null;
  parent_id?: number | null;
  categories?: Category[];
  planning_levels?: PlanningLevel[];
  in_klaerung: boolean;
  // App.tsx stores pco_id as string | number | null, so accept both here.
  pco_id?: string | number | null;
  attachments?: string | null;
  besucherzahl?: number | null;
  mail?: string | null;
  ort?: string | null;
  link_id?: number | null;
};
type EventListItem = {
  id: number;
  title: string;
  parent_id: number | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  preacher?: string | null;
  sermon_title?: string | null;
  remarks?: string | null;
  internal_notes?: string | null;
  clarification?: string | null;
  link?: string | null;
  description?: string | null;
  categories?: Category[];
  planning_levels?: PlanningLevel[];
  link_id?: number | null;
};


type ReportingEntry = {
  id: number;
  event_id: number;
  event_title: string;
  event_date?: string | null;
  event_start_time?: string | null;
  visitor?: number | null;
  vacation?: string | null;
  holiday?: string | null;
  special?: string | null;
};


type AddEventFormMode = "create" | "edit" | "duplicate";

interface AddEventFormProps {
  mode: AddEventFormMode;
  eventToEdit: EventForEdit | null;
  onCancelEdit: () => void;
  onCreated: () => void;
  parentOptions: EventForSelect[];
  categoryOptions: Category[];
  planningLevelOptions: PlanningLevel[];
  initialParentId: number | null;
  allEvents?: EventListItem[];
  onOpenEditFromRelated?: (eventId: number) => void;

  // Actions triggered from inside the modal (App owns the actual operations)
  onRequestDuplicate?: () => void;
  onRequestAddSubEvent?: () => void;
  onRequestDelete?: () => void;
}

type MultiOption = {
  id: number;
  name: string;
};

type ParentValue = number | "";

type FieldKey =
  | "parent_id"
  | "title"
  | "planning_levels"
  | "start_date"
  | "end_date"
  | "start_time"
  | "end_time"
  | "preacher"
  | "sermon_title"
  | "categories"
  | "remarks"
  | "internal_notes"
  | "clarification"
  | "link"
  | "in_klaerung"
  | "pco_id"
  | "attachments"
  | "besucherzahl"
  | "mail"
  | "location"
  | "link_id";

type FieldVisibility = Record<FieldKey, boolean>;

const DEFAULT_FIELD_VISIBILITY: FieldVisibility = {
  parent_id: true,
  title: true,
  planning_levels: true,
  start_date: true,
  end_date: true,
  start_time: true,
  end_time: true,
  preacher: true,
  sermon_title: true,
  categories: true,
  remarks: true,
  internal_notes: true,
  clarification: true,
  link: true,
  in_klaerung: false,
  pco_id: false,
  attachments: false,
  besucherzahl: false,
  mail: false,
  location: false,
  link_id: false,
};

const CATEGORY_FIELD_VISIBILITY: Record<string, FieldVisibility> = {
  "Gottesdienst": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: false,
    in_klaerung: true,
    pco_id: true,
    attachments: true,
    besucherzahl: true,
    mail: false,
    location: false,
    link_id: true,
  },
  "Kollekte": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: false,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Kindersegnung": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: false,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Taufe": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: false,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Predigtreihe": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Gastprediger": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: false,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: true,
    location: false,
    link_id: false,
  },
  "Lobpreis": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: true,
    in_klaerung: true,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Abendmahl": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Ferien": {
    parent_id: false,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: false,
    end_time: false,
    preacher: false,
    sermon_title: false,
    categories: false,
    remarks: false,
    internal_notes: false,
    clarification: false,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Team night": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: true,
    in_klaerung: true,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Schatzinsel": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Bibel": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: false,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Connect / Jet": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: true,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Treffen": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: true,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Camp / Freizeit": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: false,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Feiertag": {
    parent_id: false,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: false,
    end_time: false,
    preacher: false,
    sermon_title: false,
    categories: false,
    remarks: false,
    internal_notes: false,
    clarification: false,
    link: false,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Gebet": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: true,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
  "Evangelisation": {
    parent_id: true,
    title: true,
    planning_levels: true,
    start_date: true,
    end_date: true,
    start_time: true,
    end_time: true,
    preacher: true,
    sermon_title: true,
    categories: true,
    remarks: true,
    internal_notes: true,
    clarification: true,
    link: true,
    in_klaerung: false,
    pco_id: false,
    attachments: false,
    besucherzahl: false,
    mail: false,
    location: false,
    link_id: false,
  },
};

const ALL_FIELD_KEYS = Object.keys(DEFAULT_FIELD_VISIBILITY) as FieldKey[];

function computeFieldVisibility(
  selectedCategoryNames: string[]
): FieldVisibility {
  if (selectedCategoryNames.length === 0) {
    return { ...DEFAULT_FIELD_VISIBILITY };
  }

  const result: FieldVisibility = {} as FieldVisibility;
  for (const key of ALL_FIELD_KEYS) {
    result[key] = false;
  }

  for (const name of selectedCategoryNames) {
    const config =
      CATEGORY_FIELD_VISIBILITY[name] ?? DEFAULT_FIELD_VISIBILITY;
    for (const key of ALL_FIELD_KEYS) {
      if (config[key]) {
        result[key] = true;
      }
    }
  }


  // Ensure required fields for Gottesdienst are always visible
  if (selectedCategoryNames.includes("Gottesdienst")) {
    result.preacher = true;
    result.sermon_title = true;
    result.pco_id = true;
    result.attachments = true;
    result.besucherzahl = true;
  }

  return result;
}

function formatDisplayDate(event: { start_date?: string | null; end_date?: string | null }): string {
  const { start_date, end_date } = event;
  if (!start_date && !end_date) {
    return "";
  }

  const formatOne = (value: string | null | undefined): string => {
    if (!value) return "";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const startLabel = formatOne(start_date ?? undefined);
  const endLabel = formatOne(end_date ?? undefined);

  if (startLabel && endLabel && endLabel !== startLabel) {
    return `${startLabel} → ${endLabel}`;
  }

  return startLabel || endLabel || "";
}

function formatTimeRange(event: { start_time?: string | null; end_time?: string | null }): string {
  const { start_time, end_time } = event;
  if (!start_time && !end_time) return "";
  if (start_time && end_time && start_time !== end_time) {
    return `${start_time} → ${end_time}`;
  }
  return start_time || end_time || "";
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

interface ParentSelectProps {
  value: ParentValue;
  onChange: (value: ParentValue) => void;
  options: EventForSelect[];
}

const ParentEventSelect: React.FC<ParentSelectProps> = ({
  value,
  onChange,
  options,
}) => {
  type SelectOption = { id: ParentValue; title: string };

  const allOptions: SelectOption[] = [
    { id: "", title: "Kein übergeordnetes Event" },
    ...options.map((o) => ({ id: o.id as ParentValue, title: o.title })),
  ];

  const selected =
    allOptions.find((opt) => opt.id === value) ?? allOptions[0];

  return (
    <div className="flex flex-col gap-1">
      <Listbox value={value} onChange={onChange}>
        <Listbox.Label className="text-xs font-medium text-slate-700">
          Übergeordnetes Event
        </Listbox.Label>
        <div className="relative mt-0.5">
          <Listbox.Button className="relative w-full cursor-default rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-left text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
            <span className="block truncate text-slate-900">
              {selected?.title ?? "Kein übergeordnetes Event"}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-slate-400">
              ▼
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none">
              {allOptions.map((opt) => (
                <Listbox.Option
                  key={String(opt.id)}
                  value={opt.id}
                  className={({ active, selected }) =>
                    classNames(
                      "relative cursor-default select-none py-2 pl-3 pr-9",
                      active ? "bg-brand-50 text-slate-900" : "text-slate-700",
                      selected && "font-medium"
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={classNames(
                          "block truncate",
                          selected && "font-semibold"
                        )}
                      >
                        {opt.title}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-brand-600">
                          ✓
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};

interface LinkedEventSelectProps {
  value: ParentValue;
  onChange: (value: ParentValue) => void;
  options: EventForSelect[];
}

const LinkedEventSelect: React.FC<LinkedEventSelectProps> = ({
  value,
  onChange,
  options,
}) => {
  type SelectOption = { id: ParentValue; title: string };

  const allOptions: SelectOption[] = [
    { id: "", title: "Kein verknüpftes Event" },
    ...options.map((o) => ({ id: o.id as ParentValue, title: o.title })),
  ];

  const selected =
    allOptions.find((opt) => opt.id === value) ?? allOptions[0];

  return (
    <div className="flex flex-col gap-1">
      <Listbox value={value} onChange={onChange}>
        <Listbox.Label className="text-xs font-medium text-slate-700">
          Verknüpftes Event
        </Listbox.Label>
        <div className="relative mt-0.5">
          <Listbox.Button className="relative w-full cursor-default rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-left text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
            <span className="block truncate text-slate-900">
              {selected?.title ?? "Kein verknüpftes Event"}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-slate-400">
              ▼
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none">
              {allOptions.map((opt) => (
                <Listbox.Option
                  key={String(opt.id)}
                  value={opt.id}
                  className={({ active, selected }) =>
                    classNames(
                      "relative cursor-default select-none py-2 pl-3 pr-9",
                      active ? "bg-brand-50 text-slate-900" : "text-slate-700",
                      selected && "font-medium"
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={classNames(
                          "block truncate",
                          selected && "font-semibold"
                        )}
                      >
                        {opt.title}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-brand-600">
                          ✓
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};

interface MultiSelectListboxProps {
  label: string;
  options: MultiOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
}

const MultiSelectListbox: React.FC<MultiSelectListboxProps> = ({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
}) => {
  const selectedItems = options.filter((o) => selectedIds.includes(o.id));

  return (
    <div className="flex flex-col gap-1">
      <Listbox
        value={selectedIds}
        onChange={(value: number[]) => onChange(value)}
        multiple
      >
        <Listbox.Label className="text-xs font-medium text-slate-700">
          {label}
        </Listbox.Label>
        <div className="relative mt-0.5">
          <Listbox.Button className="relative w-full cursor-default rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-left text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
            <span className="flex flex-wrap gap-1 truncate text-slate-900">
              {selectedItems.length === 0 ? (
                <span className="text-slate-400">{placeholder}</span>
              ) : (
                selectedItems.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
                  >
                    {item.name}
                  </span>
                ))
              )}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-slate-400">
              ▼
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none">
              {options.map((opt) => (
                <Listbox.Option
                  key={opt.id}
                  value={opt.id}
                  className={({ active, selected }) =>
                    classNames(
                      "relative cursor-default select-none py-1.5 pl-3 pr-9",
                      active ? "bg-brand-50 text-slate-900" : "text-slate-700",
                      selected && "font-medium"
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={classNames(
                          "block truncate",
                          selected && "font-semibold"
                        )}
                      >
                        {opt.name}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-brand-600">
                          ✓
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};

const AddEventForm: React.FC<AddEventFormProps> = ({
  mode,
  eventToEdit,
  onCancelEdit,
  onCreated,
  parentOptions,
  categoryOptions,
  planningLevelOptions,
  initialParentId,
  allEvents = [],
  onOpenEditFromRelated,
  onRequestDuplicate,
  onRequestAddSubEvent,
  onRequestDelete,
}) => {
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<ParentValue>(
    initialParentId ?? ""
  );
  const [linkedEventId, setLinkedEventId] = useState<ParentValue>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [preacher, setPreacher] = useState("");
  const [sermonTitle, setSermonTitle] = useState("");
  const [remarks, setRemarks] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [clarification, setClarification] = useState("");
  const [link, setLink] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedPlanningLevelIds, setSelectedPlanningLevelIds] = useState<
    number[]
  >([]);
  const [inKlaerung, setInKlaerung] = useState(false);
  const [pcoId, setPcoId] = useState("");
  const [attachments, setAttachments] = useState("");
  const [besucherzahl, setBesucherzahl] = useState("");
  const [mail, setMail] = useState("");
  const [ort, setOrt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reporting (Besucher) state
  const [reportingVisitor, setReportingVisitor] = useState("");
  const [reportingLoading, setReportingLoading] = useState(false);
  const [reportingError, setReportingError] = useState<string | null>(null);
  const [lastReportingEntry, setLastReportingEntry] = useState<ReportingEntry | null>(null);
  const [reportingInitialized, setReportingInitialized] = useState(false);

  const resetForm = () => {
    setTitle("");
    setParentId(initialParentId ?? "");
    setLinkedEventId("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setPreacher("");
    setSermonTitle("");
    setRemarks("");
    setInternalNotes("");
    setClarification("");
    setLink("");
    setSelectedCategoryIds([]);
    setSelectedPlanningLevelIds([]);
    setInKlaerung(false);
    setPcoId("");
    setAttachments("");
    setBesucherzahl("");
    setMail("");
    setOrt("");
    setError(null);
  };

  useEffect(() => {
    if ((mode === "edit" || mode === "duplicate") && eventToEdit) {
      setTitle(eventToEdit.title || "");
      setParentId(eventToEdit.parent_id ?? "");
      setLinkedEventId(eventToEdit.link_id ?? "");
      setStartDate(eventToEdit.start_date ?? "");
      setEndDate(eventToEdit.end_date ?? "");
      setStartTime(eventToEdit.start_time ?? "");
      setEndTime(eventToEdit.end_time ?? "");
      setPreacher(eventToEdit.preacher ?? "");
      setSermonTitle(eventToEdit.sermon_title ?? "");
      setRemarks(eventToEdit.remarks ?? "");
      setInternalNotes(eventToEdit.internal_notes ?? "");
      setClarification(eventToEdit.clarification ?? "");
      setLink(eventToEdit.link ?? "");
      setSelectedCategoryIds(
        eventToEdit.categories?.map((c) => c.id) ?? []
      );
      setSelectedPlanningLevelIds(
        eventToEdit.planning_levels?.map((p) => p.id) ?? []
      );
      setInKlaerung(eventToEdit.in_klaerung ?? false);
      setPcoId(
        eventToEdit.pco_id !== undefined && eventToEdit.pco_id !== null
          ? String(eventToEdit.pco_id)
          : ""
      );
      setAttachments(eventToEdit.attachments ?? "");
      setBesucherzahl(
        eventToEdit.besucherzahl !== undefined &&
        eventToEdit.besucherzahl !== null
          ? String(eventToEdit.besucherzahl)
          : ""
      );
      setMail(eventToEdit.mail ?? "");
      setOrt(eventToEdit.ort ?? "");
    } else {
      resetForm();
    }
    setError(null);
  }, [mode, eventToEdit, initialParentId]);

  const selectedCategoryNames = useMemo(
    () =>
      categoryOptions
        .filter((c) => selectedCategoryIds.includes(c.id))
        .map((c) => c.name),
    [categoryOptions, selectedCategoryIds]
  );

  const isGottesdienstSelected = selectedCategoryNames.includes("Gottesdienst");

  useEffect(() => {
    if (!isGottesdienstSelected) {
      return;
    }

    if (!startTime) {
      setTitle("Gottesdienst");
      return;
    }

    const [hourRaw, minute] = startTime.split(":");
    const hourNumber = Number(hourRaw);
    const displayHour = Number.isNaN(hourNumber) ? hourRaw : String(hourNumber);
    const timeLabel =
      !minute || minute === "00" ? displayHour : `${displayHour}:${minute}`;

    const autoTitle = `Godi ${timeLabel}er`;
    setTitle(autoTitle);
  }, [isGottesdienstSelected, startTime]);

  const fieldVisibility = useMemo(
    () => computeFieldVisibility(selectedCategoryNames),
    [selectedCategoryNames]
  );

  const relatedEvents = useMemo(() => {
    if (!eventToEdit) {
      return [] as EventListItem[];
    }

    const source = (allEvents && allEvents.length > 0
      ? allEvents
      : parentOptions) as EventListItem[];

    if (!source || source.length === 0) {
      return [] as EventListItem[];
    }

    const map = new Map<number, EventListItem>();

    // Direct children (klassische Unter-Events)
    source.forEach((ev) => {
      if (ev.parent_id === eventToEdit.id) {
        map.set(ev.id, ev);
      }
    });

    // Parent of current event
    if (eventToEdit.parent_id != null) {
      const parent = source.find((ev) => ev.id === eventToEdit.parent_id);
      if (parent) {
        map.set(parent.id, parent);
      }
    }

    // Events that link TO the current event (link_id === id)
    source.forEach((ev) => {
      if (ev.link_id === eventToEdit.id) {
        map.set(ev.id, ev);
      }
    });

    // Event that this event links TO (eventToEdit.link_id)
    if (eventToEdit.link_id != null) {
      const linkedTarget = source.find((ev) => ev.id === eventToEdit.link_id);
      if (linkedTarget) {
        map.set(linkedTarget.id, linkedTarget);
      }
    }

    return Array.from(map.values());
  }, [allEvents, parentOptions, eventToEdit]);

  const predigtreiheOrGastpredigerEvents = useMemo(() => {
    if (!isGottesdienstSelected) {
      return [] as EventListItem[];
    }
    return relatedEvents.filter((ev) =>
      ev.categories?.some(
        (cat) => cat.name === "Predigtreihe" || cat.name === "Gastprediger"
      )
    );
  }, [isGottesdienstSelected, relatedEvents]);

  const otherRelatedEvents = useMemo(() => {
    if (!isGottesdienstSelected) {
      return relatedEvents;
    }
    return relatedEvents.filter(
      (ev) =>
        !ev.categories?.some(
          (cat) => cat.name === "Predigtreihe" || cat.name === "Gastprediger"
        )
    );
  }, [isGottesdienstSelected, relatedEvents]);

  const displayRelatedEvents = useMemo(
    () =>
      isGottesdienstSelected ? otherRelatedEvents : relatedEvents,
    [isGottesdienstSelected, otherRelatedEvents, relatedEvents]
  );


  // --- Reporting (Besucher) ---
  useEffect(() => {
    if (mode !== "edit" || !eventToEdit || reportingInitialized) {
      return;
    }

    const loadReporting = async () => {
      try {
        const response = await apiFetch(`/reporting/by-event/${eventToEdit.id}`);
        if (!response.ok) {
          return;
        }
        const data: ReportingEntry[] = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setLastReportingEntry(data[0]);
          if (data[0].visitor !== null && data[0].visitor !== undefined) {
            setReportingVisitor(String(data[0].visitor));
          }
        }
      } catch (err) {
        console.error("Failed to load reporting entries", err);
      } finally {
        setReportingInitialized(true);
      }
    };

    loadReporting();
  }, [mode, eventToEdit, reportingInitialized]);


  const handleSaveReporting = async () => {
    if (!eventToEdit) return;

    const raw = reportingVisitor.trim();
    if (!raw) {
      setReportingError("Bitte eine Besucherzahl eingeben.");
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setReportingError("Besucherzahl muss eine positive Zahl sein.");
      return;
    }

    setReportingLoading(true);
    setReportingError(null);

    try {
      const response = await apiFetch("/reporting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventToEdit.id,
          visitor: value,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const saved: ReportingEntry = await response.json();
      setLastReportingEntry(saved);
    } catch (err) {
      console.error("Failed to save reporting entry", err);
      setReportingError(
        "Besucher-Reporting konnte nicht gespeichert werden. Bitte erneut versuchen."
      );
    } finally {
      setReportingLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        title: title.trim(),
        parent_id: parentId === "" ? null : parentId,
        link_id: linkedEventId === "" ? null : linkedEventId,
        start_date: startDate || null,
        end_date: endDate || null,
        start_time: startTime || null,
        end_time: endTime || null,
        preacher: preacher || null,
        sermon_title: sermonTitle || null,
        remarks: remarks || null,
        internal_notes: internalNotes || null,
        clarification: clarification || null,
        link: link || null,
        category_ids: selectedCategoryIds,
        planning_level_ids: selectedPlanningLevelIds,
        in_klaerung: inKlaerung,
        pco_id: pcoId ? Number(pcoId) : null,
        attachments: attachments || null,
        besucherzahl: besucherzahl ? Number(besucherzahl) : null,
        mail: mail || null,
        ort: ort || null,
      };

      let response: Response;
      if (mode === "edit" && eventToEdit) {
        response = await apiFetch(`/events/${eventToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await apiFetch("/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      onCreated();
      if (mode === "edit" || mode === "duplicate") {
        onCancelEdit();
      }
      resetForm();
    } catch (err) {
      console.error("Failed to submit event", err);
      setError(
        "Event konnte nicht gespeichert werden. Bitte Eingaben prüfen oder erneut versuchen."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modeLabel =
    mode === "edit"
      ? "Event bearbeiten"
      : mode === "duplicate"
      ? "Event duplizieren"
      : "Neues Event anlegen";

  const modeDescription =
    mode === "edit"
      ? "Details des ausgewählten Events aktualisieren."
      : mode === "duplicate"
      ? "Eine Kopie des Events erstellen und bei Bedarf anpassen."
      : "Neues Event erstellen und Hierarchie & Metadaten festlegen.";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-borderSubtle bg-surface p-5 shadow-subtle ring-1 ring-slate-100 max-h-[80vh] overflow-y-auto"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="m-0 text-lg font-semibold text-slate-900">
            {modeLabel}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {modeDescription}
          </p>
        </div>

      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Titel & Hierarchie */}
      <section className="space-y-3 border-b border-borderSubtle pb-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)]">
          {fieldVisibility.title && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700">
                Titel *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  if (!isGottesdienstSelected) {
                    setTitle(e.target.value);
                  }
                }}
                readOnly={isGottesdienstSelected}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Titel des Events"
                required
              />
            </div>
          )}
          {fieldVisibility.parent_id && (
            <ParentEventSelect
              value={parentId}
              onChange={setParentId}
              options={parentOptions}
            />
          )}
        </div>
      </section>

      {/* Zeitplan */}
      {(fieldVisibility.start_date ||
        fieldVisibility.end_date ||
        fieldVisibility.start_time ||
        fieldVisibility.end_time) && (
        <section className="space-y-3 border-b border-borderSubtle pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Zeitplan
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {fieldVisibility.start_date && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Startdatum
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}
            {fieldVisibility.end_date && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Enddatum
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}
            {fieldVisibility.start_time && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Startzeit
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}
            {fieldVisibility.end_time && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Endzeit
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Personen & Inhalt */}
      {(fieldVisibility.preacher || fieldVisibility.sermon_title) && (
        <section className="space-y-3 border-b border-borderSubtle pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Personen &amp; Inhalt
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {fieldVisibility.preacher && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Prediger
                </label>
                <input
                  type="text"
                  value={preacher}
                  onChange={(e) => setPreacher(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Name des Predigers"
                />
              </div>
            )}
            {fieldVisibility.sermon_title && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Predigttitel
                </label>
                <input
                  type="text"
                  value={sermonTitle}
                  onChange={(e) => setSermonTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Titel der Predigt"
                />
              </div>
            )}
          </div>
          {isGottesdienstSelected && predigtreiheOrGastpredigerEvents.length > 0 && (
            <div className="mt-3 rounded-lg border border-borderSubtle bg-slate-50 px-3 py-2">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                Verknüpfte Predigtreihen &amp; Gastprediger
              </h4>
              <ul className="space-y-2">
                {predigtreiheOrGastpredigerEvents.map((ev) => {
                  const dateLabel = formatDisplayDate(ev);
                  const timeLabel = formatTimeRange(ev);
                  return (
                    <li key={ev.id}>
                      <div
                        onClick={() => onOpenEditFromRelated?.(ev.id)}
                        className="flex cursor-pointer items-stretch gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-slate-900">
                              {ev.title}
                            </h2>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            {dateLabel && <span>{dateLabel}</span>}
                            {timeLabel && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span>{timeLabel}</span>
                              </>
                            )}
                            {ev.planning_levels && ev.planning_levels.length > 0 && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span>
                                  {ev.planning_levels.map((pl) => pl.name).join(", ")}
                                </span>
                              </>
                            )}
                          </div>

                          {ev.categories && ev.categories.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {ev.categories.map((cat) => (
                                <span
                                  key={cat.id}
                                  className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-900"
                                  style={{
                                    backgroundColor: (cat as any).color_hex || "#eef2ff",
                                    border: "1px solid rgba(148,163,184,0.35)",
                                  }}
                                >
                                  {(cat as any).symbol && (
                                    <span className="text-xs">{(cat as any).symbol}</span>
                                  )}
                                  <span className="truncate">{cat.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        </section>
      )}

      {/* Zusätzliche Informationen */}
      {(fieldVisibility.remarks ||
        fieldVisibility.internal_notes ||
        fieldVisibility.attachments) && (
        <section className="space-y-3 border-b border-borderSubtle pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Zusätzliche Informationen
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            {fieldVisibility.remarks && (
              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-xs font-medium text-slate-700">
                  Bemerkungen (sichtbar)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Hinweise, die für alle sichtbar sind."
                />
              </div>
            )}
            {fieldVisibility.internal_notes && (
              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-xs font-medium text-slate-700">
                  Interne Notizen
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Nur für das Planungsteam."
                />
              </div>
            )}

            {fieldVisibility.attachments && (
              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-xs font-medium text-slate-700">
                  Attachments
                </label>
                <input
                  type="text"
                  value={attachments}
                  onChange={(e) => setAttachments(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="z.B. Dateiname oder Link"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Status & Logistik */}
      {(fieldVisibility.in_klaerung ||
        fieldVisibility.pco_id ||
        fieldVisibility.besucherzahl ||
        fieldVisibility.mail ||
        fieldVisibility.location ||
        fieldVisibility.link_id ||
        fieldVisibility.clarification) && (
        <section className="space-y-3 border-b border-borderSubtle pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Status &amp; Logistik
          </h3>
          <div className="grid gap-3 md:grid-cols-4">
            {fieldVisibility.in_klaerung && (
              <div className="flex items-center gap-2 md:col-span-1">
                <input
                  id="in_klaerung"
                  type="checkbox"
                  checked={inKlaerung}
                  onChange={(e) => setInKlaerung(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label
                  htmlFor="in_klaerung"
                  className="text-xs font-medium text-slate-700"
                >
                  In Klärung
                </label>
              </div>
            )}

            {fieldVisibility.clarification && (
              <div className="flex flex-col gap-1.5 md:col-span-3">
                <label className="text-xs font-medium text-slate-700">
                  Klärung / offene Punkte
                </label>
                <textarea
                  value={clarification}
                  onChange={(e) => setClarification(e.target.value)}
                  className="min-h-[60px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Fragen, Abhängigkeiten oder Unklares."
                />
              </div>
            )}
            {fieldVisibility.pco_id && (
              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-xs font-medium text-slate-700">
                  PCO ID
                </label>
                <input
                  type="number"
                  value={pcoId}
                  onChange={(e) => setPcoId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="z.B. 12345"
                />
              </div>
            )}
            {fieldVisibility.besucherzahl && (
              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-xs font-medium text-slate-700">
                  Besucherzahl
                </label>
                <input
                  type="number"
                  value={besucherzahl}
                  onChange={(e) => setBesucherzahl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Anzahl Besucher"
                />
              </div>
            )}
            {fieldVisibility.mail && (
              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-xs font-medium text-slate-700">
                  Mail
                </label>
                <input
                  type="email"
                  value={mail}
                  onChange={(e) => setMail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="name@beispiel.de"
                />
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {fieldVisibility.location && (
              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-xs font-medium text-slate-700">
                  Ort
                </label>
                <input
                  type="text"
                  value={ort}
                  onChange={(e) => setOrt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Ort oder Location"
                />
              </div>
            )}
            {fieldVisibility.link_id && (
              <div className="md:col-span-1">
                <LinkedEventSelect
                  value={linkedEventId}
                  onChange={setLinkedEventId}
                  options={parentOptions}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Link */}
      {fieldVisibility.link && (
        <section className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700">Link</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="https://…"
            />
          </div>
        </section>
      )}

      {/* Reporting / Besucher */}
      {mode === "edit" && eventToEdit && (
        <section className="space-y-3 border-b border-borderSubtle pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Besucher-Reporting
          </h3>
          <p className="text-xs text-slate-500">
            Erfasse hier die Besucherzahl für dieses Event. Die Werte werden in einer separaten Reporting-Tabelle gespeichert.
          </p>

          {reportingError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-2">
              {reportingError}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700">
                Besucherzahl (Reporting)
              </label>
              <input
                type="number"
                min={0}
                value={reportingVisitor}
                onChange={(e) => setReportingVisitor(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="z.B. 120"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveReporting}
              disabled={reportingLoading || !eventToEdit}
              className="inline-flex items-center justify-center gap-1 text-xs font-semibold focus:outline-none"
              style={{
                minWidth: 180,
                borderRadius: 9999,
                padding: "8px 20px",
                background: reportingLoading ? "#4f46e5" : "#4338ca",
                color: "#ffffff",
                border: "1px solid #3730a3",
                boxShadow: "0 6px 14px rgba(79,70,229,0.35)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: reportingLoading ? "wait" : "pointer",
                opacity: reportingLoading ? 0.9 : 1,
              }}
            >
              <span style={{ fontSize: "12px" }}>
                {reportingLoading ? "…" : "✓"}
              </span>
              <span>
                {reportingLoading ? "Speichern…" : "Besucherzahl erfassen"}
              </span>
            </button>
          </div>

          {lastReportingEntry && (
            <div className="mt-2 text-xs text-slate-500">
              Letzte erfasste Besucherzahl:{" "}
              <span className="font-semibold">
                {lastReportingEntry.visitor ?? "-"}
              </span>
              {lastReportingEntry.event_date && (
                <>
                  {" "}
                  (für den{" "}
                  {new Date(lastReportingEntry.event_date).toLocaleDateString(
                    undefined,
                    { year: "numeric", month: "2-digit", day: "2-digit" }
                  )}
                  )
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* Verknüpfte / untergeordnete Events (nur im Edit-Modus) */}
      {mode === "edit" && eventToEdit && displayRelatedEvents.length > 0 && (
        <section className="space-y-3 border-b border-borderSubtle pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Verknüpfte &amp; untergeordnete Events
          </h3>
          <ul className="space-y-2">
            {displayRelatedEvents.map((ev) => {
              const dateLabel = formatDisplayDate(ev);
              const timeLabel = formatTimeRange(ev);
              return (
                <li key={ev.id}>
                  <div onClick={() => onOpenEditFromRelated?.(ev.id)} className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-slate-900">
                          {ev.title}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {dateLabel && <span>{dateLabel}</span>}
                        {timeLabel && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span>{timeLabel}</span>
                          </>
                        )}
                        {ev.planning_levels && ev.planning_levels.length > 0 && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span>
                              {ev.planning_levels.map((pl) => pl.name).join(", ")}
                            </span>
                          </>
                        )}
                      </div>

                      {ev.categories && ev.categories.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {ev.categories.map((cat) => (
                            <span
                              key={cat.id}
                              className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-900"
                              style={{
                                backgroundColor: cat.color_hex || "#eef2ff",
                              }}
                            >
                              {cat.symbol && (
                                <span className="text-xs">{cat.symbol}</span>
                              )}
                              <span className="truncate">{cat.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      
  


      {/* Einordnung */}
      {(fieldVisibility.categories || fieldVisibility.planning_levels) && (
        <section className="space-y-3 border-b border-borderSubtle pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Einordnung
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {fieldVisibility.categories && (
              <MultiSelectListbox
                label="Kategorien"
                options={categoryOptions}
                selectedIds={selectedCategoryIds}
                onChange={setSelectedCategoryIds}
                placeholder="Eine oder mehrere Kategorien wählen"
              />
            )}
            {fieldVisibility.planning_levels && (
              <MultiSelectListbox
                label="Planungslevel"
                options={planningLevelOptions}
                selectedIds={selectedPlanningLevelIds}
                onChange={setSelectedPlanningLevelIds}
                placeholder="Planungsreife markieren"
              />
            )}
          </div>
        </section>
      )}


  
<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-borderSubtle pt-3">
  {(mode === "edit" || mode === "duplicate") && (
    <button
      type="button"
      onClick={onCancelEdit}
      className="inline-flex items-center gap-1 text-xs font-medium focus:outline-none"
      style={{
        borderRadius: 9999,
        border: "1px solid #cbd5f5",
        padding: "6px 16px",
        background: "#eef2ff",
        color: "#1e293b",
        boxShadow: "0 1px 2px rgba(15,23,42,0.12)",
      }}
    >
      <span style={{ fontSize: "12px" }}>✕</span>
      <span>Abbrechen</span>
    </button>
  )}


  {mode === "edit" && eventToEdit && (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onRequestDuplicate}
        disabled={!onRequestDuplicate}
        className="inline-flex items-center gap-1 text-xs font-medium focus:outline-none disabled:opacity-50"
        style={{
          borderRadius: 9999,
          border: "1px solid #cbd5e1",
          padding: "6px 16px",
          background: "#f8fafc",
          color: "#0f172a",
          boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
        }}
      >
        <span style={{ fontSize: "12px" }}>⎘</span>
        <span>Duplizieren</span>
      </button>

      <button
        type="button"
        onClick={onRequestAddSubEvent}
        disabled={!onRequestAddSubEvent}
        className="inline-flex items-center gap-1 text-xs font-medium focus:outline-none disabled:opacity-50"
        style={{
          borderRadius: 9999,
          border: "1px solid #3730a3",
          padding: "6px 16px",
          background: "#4338ca",
          color: "#ffffff",
          boxShadow: "0 6px 14px rgba(79,70,229,0.28)",
        }}
      >
        <span style={{ fontSize: "12px" }}>＋</span>
        <span>Unter-Event</span>
      </button>

      <button
        type="button"
        onClick={onRequestDelete}
        disabled={!onRequestDelete}
        className="inline-flex items-center gap-1 text-xs font-medium focus:outline-none disabled:opacity-50"
        style={{
          borderRadius: 9999,
          border: "1px solid #b91c1c",
          padding: "6px 16px",
          background: "#dc2626",
          color: "#ffffff",
          boxShadow: "0 6px 14px rgba(220,38,38,0.25)",
        }}
      >
        <span style={{ fontSize: "12px" }}>🗑</span>
        <span>Löschen</span>
      </button>
    </div>
  )}

  <div className="flex flex-wrap justify-end gap-2">
    <button
      type="button"
      onClick={resetForm}
      className="inline-flex items-center gap-1 text-xs font-medium focus:outline-none"
      style={{
        borderRadius: 9999,
        border: "1px solid #bfdbfe",
        padding: "6px 18px",
        background: "#dbeafe",
        color: "#1e3a8a",
        boxShadow: "0 1px 2px rgba(30,64,175,0.22)",
      }}
    >
      <span style={{ fontSize: "12px" }}>↺</span>
      <span>Formular zurücksetzen</span>
    </button>
    <button
      type="submit"
      disabled={submitting}
      className="inline-flex items-center justify-center gap-1 text-xs font-semibold focus:outline-none"
      style={{
        minWidth: 170,
        borderRadius: 9999,
        padding: "8px 22px",
        background: submitting ? "#4f46e5" : "#4338ca",
        color: "#ffffff",
        border: "1px solid #3730a3",
        boxShadow: "0 8px 18px rgba(79,70,229,0.4)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        cursor: submitting ? "wait" : "pointer",
        opacity: submitting ? 0.9 : 1,
      }}
    >
      <span style={{ fontSize: "12px" }}>
        {submitting ? "…" : "✓"}
      </span>
      <span>
        {submitting
          ? "Speichern…"
          : mode === "edit"
          ? "Änderungen speichern"
          : "Event anlegen"}
      </span>
    </button>
  </div>
</div></form>
  );
};

export default AddEventForm;
