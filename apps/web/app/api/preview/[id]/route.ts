import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = sessionStore.getOrCreate(id);

  if (!session) {
    return new NextResponse("Session not found", { status: 404 });
  }

  const appTsx = session.files["src/App.tsx"] || "";
  const title = session.title || "CodeForge Preview";

  // Check if it's Netflix clone
  if (appTsx.includes("CODEFORGE FLIX") || title.toLowerCase().includes("netflix")) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #141414; color: #fff; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .hide-scrollbar::-webkit-scrollbar { display: none; }
    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body class="bg-[#141414] text-white">
  <header class="fixed top-0 z-40 flex w-full items-center justify-between bg-gradient-to-b from-black/90 to-transparent px-8 py-4 backdrop-blur-sm">
    <div class="flex items-center gap-8">
      <span class="text-2xl font-black tracking-wider text-red-600">CODEFORGE FLIX</span>
      <nav class="hidden md:flex gap-6 text-sm text-zinc-300">
        <a href="#" class="font-semibold text-white">Home</a>
        <a href="#" class="hover:text-white transition">TV Shows</a>
        <a href="#" class="hover:text-white transition">Movies</a>
        <a href="#" class="hover:text-white transition">New & Popular</a>
        <a href="#" class="hover:text-white transition">My List</a>
      </nav>
    </div>
    <div class="flex items-center gap-4 text-sm">
      <span class="text-xs text-zinc-400">Sandbox Preview</span>
      <button class="rounded bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700">Account</button>
    </div>
  </header>

  <div class="relative h-[70vh] w-full overflow-hidden">
    <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80" alt="Hero" class="h-full w-full object-cover brightness-50" />
    <div class="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/60 to-transparent"></div>
    <div class="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent"></div>

    <div class="absolute bottom-16 left-8 max-w-xl space-y-4">
      <span class="inline-block rounded bg-red-600/90 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
        TOP 10 TODAY IN TV SHOWS
      </span>
      <h1 class="text-5xl font-extrabold tracking-tight">Stranger Encounters</h1>
      <p class="text-sm leading-relaxed text-zinc-300">
        When a young boy vanishes from a tranquil midwestern town, a mystery unfolds involving secret experiments and terrifying supernatural forces.
      </p>
      <div class="flex items-center gap-4 pt-2">
        <button onclick="document.getElementById('notice').innerText = '▶ Streaming episode 1...'" class="flex items-center gap-2 rounded bg-white px-6 py-2.5 font-bold text-zinc-900 transition hover:bg-zinc-200">
          ▶ Play
        </button>
        <button onclick="document.getElementById('notice').innerText = '✓ Added to your list'" class="flex items-center gap-2 rounded bg-zinc-600/70 px-5 py-2.5 font-semibold text-white backdrop-blur transition hover:bg-zinc-600">
          + Add to List
        </button>
      </div>
      <div id="notice" class="text-xs text-emerald-400 font-semibold h-4"></div>
    </div>
  </div>

  <div class="relative -mt-8 space-y-8 px-8 pb-16">
    <div>
      <h2 class="text-xl font-bold tracking-tight text-zinc-100 mb-3">Trending Now</h2>
      <div class="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
        <div class="flex-none w-52 rounded-md bg-zinc-800 overflow-hidden hover:scale-105 transition cursor-pointer">
          <img src="https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=500&q=80" class="h-32 w-full object-cover" />
          <div class="p-3"><p class="font-semibold text-sm">Cyber Horizon</p><span class="text-xs text-emerald-400 font-semibold">98% Match</span></div>
        </div>
        <div class="flex-none w-52 rounded-md bg-zinc-800 overflow-hidden hover:scale-105 transition cursor-pointer">
          <img src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=500&q=80" class="h-32 w-full object-cover" />
          <div class="p-3"><p class="font-semibold text-sm">Deep Oceans</p><span class="text-xs text-emerald-400 font-semibold">95% Match</span></div>
        </div>
        <div class="flex-none w-52 rounded-md bg-zinc-800 overflow-hidden hover:scale-105 transition cursor-pointer">
          <img src="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80" class="h-32 w-full object-cover" />
          <div class="p-3"><p class="font-semibold text-sm">Neon Velocity</p><span class="text-xs text-emerald-400 font-semibold">91% Match</span></div>
        </div>
        <div class="flex-none w-52 rounded-md bg-zinc-800 overflow-hidden hover:scale-105 transition cursor-pointer">
          <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=500&q=80" class="h-32 w-full object-cover" />
          <div class="p-3"><p class="font-semibold text-sm">Quantum Paradox</p><span class="text-xs text-emerald-400 font-semibold">99% Match</span></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Check if it's Kanban
  if (appTsx.includes("Kanban") || appTsx.includes("Task") || title.toLowerCase().includes("kanban")) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-8 font-sans">
  <header class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight">Project Sprint Board</h1>
      <p class="text-slate-400 text-sm mt-1">Manage deliverables and feature roadmaps</p>
    </div>
    <div class="flex gap-2">
      <input id="taskInput" type="text" placeholder="New task title..." class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none text-white focus:border-indigo-500" />
      <button onclick="addTask()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition">+ Add Task</button>
    </div>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-slate-200">Backlog</h2>
        <span class="text-xs bg-slate-700 px-2 py-0.5 rounded-full font-mono">2</span>
      </div>
      <div id="col-backlog" class="space-y-3">
        <div class="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-sm">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">UI/UX</span>
          <p class="mt-2 text-sm font-medium">Design user onboarding flow</p>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Medium priority</span>
            <button onclick="moveTask(this, 'col-progress')" class="hover:text-indigo-400 underline">→ In Progress</button>
          </div>
        </div>
        <div class="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-sm">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">Backend</span>
          <p class="mt-2 text-sm font-medium">Implement OAuth authentication</p>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>High priority</span>
            <button onclick="moveTask(this, 'col-progress')" class="hover:text-indigo-400 underline">→ In Progress</button>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-slate-200">In Progress</h2>
        <span class="text-xs bg-slate-700 px-2 py-0.5 rounded-full font-mono">1</span>
      </div>
      <div id="col-progress" class="space-y-3">
        <div class="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-sm">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">Core</span>
          <p class="mt-2 text-sm font-medium">Integrate real-time WebSockets</p>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>High priority</span>
            <button onclick="moveTask(this, 'col-done')" class="hover:text-emerald-400 underline">→ Done</button>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-slate-200">Done</h2>
        <span class="text-xs bg-slate-700 px-2 py-0.5 rounded-full font-mono">1</span>
      </div>
      <div id="col-done" class="space-y-3">
        <div class="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-sm">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">DevOps</span>
          <p class="mt-2 text-sm font-medium">Initial repo setup & CI/CD pipeline</p>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Completed</span>
            <span class="text-emerald-400">✓</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function addTask() {
      const input = document.getElementById('taskInput');
      const val = input.value.trim();
      if (!val) return;
      const card = document.createElement('div');
      card.className = 'bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-sm';
      card.innerHTML = \`<span class="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">Feature</span>
        <p class="mt-2 text-sm font-medium">\${val}</p>
        <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Medium priority</span>
          <button onclick="moveTask(this, 'col-progress')" class="hover:text-indigo-400 underline">→ In Progress</button>
        </div>\`;
      document.getElementById('col-backlog').appendChild(card);
      input.value = '';
    }
    function moveTask(btn, targetId) {
      const card = btn.closest('.bg-slate-900');
      document.getElementById(targetId).appendChild(card);
      if (targetId === 'col-done') {
        btn.parentElement.innerHTML = '<span>Completed</span><span class="text-emerald-400">✓</span>';
      } else if (targetId === 'col-progress') {
        btn.onclick = function() { moveTask(this, 'col-done'); };
        btn.innerText = '→ Done';
      }
    }
  </script>
</body>
</html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Check if Admin Dashboard
  if (appTsx.includes("Dashboard") || appTsx.includes("Admin") || title.toLowerCase().includes("dashboard")) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 flex min-h-screen font-sans">
  <aside class="w-64 border-r border-slate-800 p-6 flex flex-col justify-between">
    <div>
      <div class="flex items-center gap-2 mb-8">
        <div class="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-lg">F</div>
        <span class="font-bold text-xl">ForgeAdmin</span>
      </div>
      <nav class="space-y-1 text-sm text-slate-400">
        <a href="#" class="block px-3 py-2 rounded-lg bg-indigo-600/20 text-indigo-400 font-semibold">Overview</a>
        <a href="#" class="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition">Analytics</a>
        <a href="#" class="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition">Customers</a>
        <a href="#" class="block px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition">Settings</a>
      </nav>
    </div>
    <div class="text-xs text-slate-500">SoryOS-Code Sandbox Architecture v3.0</div>
  </aside>

  <main class="flex-1 p-8 overflow-y-auto">
    <header class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold">Executive Dashboard</h1>
        <p class="text-sm text-slate-400">Real-time performance metrics and revenue tracking</p>
      </div>
      <button class="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-semibold transition">
        Export Report
      </button>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <span class="text-xs text-slate-400 uppercase tracking-wider">Total Revenue</span>
        <p class="text-2xl font-extrabold mt-1">$45,231.89</p>
        <span class="text-xs text-emerald-400 mt-2 block">+20.1% this month</span>
      </div>
      <div class="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <span class="text-xs text-slate-400 uppercase tracking-wider">Active Users</span>
        <p class="text-2xl font-extrabold mt-1">+2,350</p>
        <span class="text-xs text-emerald-400 mt-2 block">+180.1% growth</span>
      </div>
      <div class="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <span class="text-xs text-slate-400 uppercase tracking-wider">Sales Velocity</span>
        <p class="text-2xl font-extrabold mt-1">+12,234</p>
        <span class="text-xs text-emerald-400 mt-2 block">+19% from average</span>
      </div>
      <div class="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <span class="text-xs text-slate-400 uppercase tracking-wider">Server Load</span>
        <p class="text-2xl font-extrabold mt-1">42%</p>
        <span class="text-xs text-slate-400 mt-2 block">Optimal state</span>
      </div>
    </div>

    <div class="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <h2 class="font-bold text-lg mb-4">Recent Transactions</h2>
      <table class="w-full text-left text-sm text-slate-300">
        <thead>
          <tr class="border-b border-slate-800 text-xs uppercase text-slate-500">
            <th class="pb-3">Order ID</th>
            <th class="pb-3">Customer</th>
            <th class="pb-3">Product</th>
            <th class="pb-3">Amount</th>
            <th class="pb-3">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          <tr><td class="py-3 font-mono text-xs">ORD-7021</td><td class="py-3 font-medium text-white">Elena Vance</td><td class="py-3">Cloud Cluster Pro</td><td class="py-3 font-semibold">$349.00</td><td><span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">Completed</span></td></tr>
          <tr><td class="py-3 font-mono text-xs">ORD-7020</td><td class="py-3 font-medium text-white">Marcus Holloway</td><td class="py-3">Edge Runtime Solo</td><td class="py-3 font-semibold">$49.00</td><td><span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">Processing</span></td></tr>
          <tr><td class="py-3 font-mono text-xs">ORD-7019</td><td class="py-3 font-medium text-white">Avery Chen</td><td class="py-3">Vector Store Addon</td><td class="py-3 font-semibold">$120.00</td><td><span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">Completed</span></td></tr>
        </tbody>
      </table>
    </div>
  </main>
</body>
</html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Generic app fallback preview
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
  <div class="max-w-md w-full bg-slate-800/60 border border-slate-700/60 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center space-y-6">
    <div class="inline-block p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
      <span class="text-4xl">⚡</span>
    </div>
    <h1 class="text-2xl font-extrabold tracking-tight">${title}</h1>
    <p class="text-slate-400 text-sm">
      Live sandbox preview generated for this workspace.
    </p>

    <div class="flex items-center justify-center gap-4 py-2">
      <button onclick="const c=document.getElementById('cnt'); c.innerText=parseInt(c.innerText)-1" class="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold transition flex items-center justify-center">-</button>
      <span id="cnt" class="text-2xl font-mono font-bold w-12 text-center">0</span>
      <button onclick="const c=document.getElementById('cnt'); c.innerText=parseInt(c.innerText)+1" class="h-10 w-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold transition flex items-center justify-center">+</button>
    </div>

    <div class="border-t border-slate-700/60 pt-4 text-xs text-slate-500">
      Powered by SoryOS-Code · Multi-Provider Sandbox Architecture
    </div>
  </div>
</body>
</html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
