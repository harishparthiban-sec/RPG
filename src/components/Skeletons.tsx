// Loading skeletons so the app never feels network-laggy.

export function QuestSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="panel p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton h-6 w-6 rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/5" />
              <div className="skeleton h-3 w-1/5" />
            </div>
            <div className="skeleton h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CharacterSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="panel p-6">
        <div className="flex items-center gap-4">
          <div className="skeleton h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <div className="skeleton h-5 w-1/3" />
            <div className="skeleton h-3 w-1/4" />
            <div className="skeleton h-3 w-full" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="panel p-5">
            <div className="skeleton h-4 w-1/3" />
            <div className="mt-3 skeleton h-2 w-full" />
            <div className="mt-2 skeleton h-3 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShopSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="panel p-5">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="mt-3 skeleton h-4 w-2/3" />
          <div className="mt-2 skeleton h-3 w-full" />
          <div className="mt-4 skeleton h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
