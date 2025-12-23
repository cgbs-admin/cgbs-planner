import React, { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";

type FilterValue = number | "";

interface Option {
  value: FilterValue;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  options: Option[];
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const FilterSelect: React.FC<FilterSelectProps> = ({
  label,
  value,
  onChange,
  options,
}) => {
  const selected = options.find((opt) => opt.value === value) ?? options[0];

  return (
    <div className="flex flex-col gap-1">
      <Listbox value={value} onChange={onChange}>
        <Listbox.Label className="text-xs font-medium text-slate-600">
          {label}
        </Listbox.Label>
        <div className="relative mt-0.5">
          <Listbox.Button className="relative w-full cursor-default rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-left text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
            <span className="block truncate text-slate-900">
              {selected?.label ?? "All"}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 text-xs">
              ▼
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none">
              {options.map((opt) => (
                <Listbox.Option
                  key={String(opt.value)}
                  value={opt.value}
                  className={({ active, selected }) =>
                    classNames(
                      "relative cursor-default select-none py-1.5 pl-3 pr-8",
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
                        {opt.label}
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

export default FilterSelect;
