"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/domain/format";
import { STARTER_COLLECTIONS, type Collection } from "@/lib/domain/product";
import { useWardrobeStore } from "@/lib/store/wardrobe-store";

const GLYPHS = [
  "🥂",
  "🌊",
  "🎀",
  "💍",
  "❄️",
  "☀️",
  "✨",
  "🖤",
  "🌸",
  "🍸",
  "🕯️",
  "♥",
];

export function CollectionDialog({
  open,
  collection,
  onClose,
}: {
  open: boolean;
  collection: Collection | null;
  onClose: () => void;
}) {
  const collections = useWardrobeStore((state) => state.collections);
  const createCollection = useWardrobeStore((state) => state.createCollection);
  const updateCollection = useWardrobeStore((state) => state.updateCollection);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>("♥");
  const [saving, setSaving] = useState(false);

  const editing = Boolean(collection);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? "");
    setEmoji(collection?.emoji ?? "♥");
    setSaving(false);
  }, [open, collection]);

  const taken = collections.some(
    (entry) =>
      entry.id !== collection?.id &&
      entry.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

  const suggestions = STARTER_COLLECTIONS.filter(
    (starter) =>
      !collections.some(
        (entry) => entry.name.toLowerCase() === starter.name.toLowerCase(),
      ),
  );

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || taken) return;
    setSaving(true);

    if (collection) {
      await updateCollection(collection.id, { name: trimmed, emoji });
      toast.success("Collection renamed", { description: trimmed });
    } else {
      const created = await createCollection(trimmed, emoji);
      if (created) {
        toast.success("Collection created", {
          description: `${emoji} ${created.name}`,
        });
      }
    }

    setSaving(false);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={editing ? "Rename" : "New"}
      title={editing ? (collection?.name ?? "") : "Create a collection"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !name.trim() || taken}
          >
            {editing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-6 pb-2">
        <Field
          label="Name"
          hint={taken ? "There is already a collection with that name." : undefined}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
            placeholder="Date Night"
            maxLength={40}
            data-autofocus
          />
        </Field>

        <div>
          <p className="mb-3 text-[0.7rem] font-medium tracking-[0.16em] text-muted uppercase">
            Glyph
          </p>
          <div className="flex flex-wrap gap-2">
            {GLYPHS.map((glyph) => (
              <motion.button
                key={glyph}
                type="button"
                onClick={() => setEmoji(glyph)}
                aria-pressed={emoji === glyph}
                aria-label={`Use ${glyph}`}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full border text-[1.05rem]",
                  "transition-colors duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  emoji === glyph
                    ? "border-accent/40 bg-petal/70"
                    : "border-line bg-card/50 hover:bg-petal/40",
                )}
                whileTap={{ scale: 0.9 }}
              >
                {glyph}
              </motion.button>
            ))}
          </div>
        </div>

        {!editing && suggestions.length ? (
          <div className="border-t border-line-warm pt-5">
            <p className="mb-3 text-[0.7rem] font-medium tracking-[0.16em] text-muted uppercase">
              Or start from one of these
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((starter) => (
                <button
                  key={starter.name}
                  type="button"
                  onClick={() => {
                    setName(starter.name);
                    setEmoji(starter.emoji);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card/50 px-3.5 py-1.5 text-[0.8rem] text-muted transition-colors duration-400 hover:bg-petal/50 hover:text-ink"
                >
                  <span>{starter.emoji}</span>
                  {starter.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
