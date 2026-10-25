/**
 * Models — liste les modèles disponibles via @soryos/provider (registre réel).
 * La source UNIQUE est le registre des providers : la commande `models`, le
 * picker `/model` et l'outil `models` de l'agent montrent donc la même liste.
 */

import { aiProviderRegistry } from "@soryos/provider";
import { println, bold, cyan, dim, green, EXIT_OK } from "../framework/ui";
import { str } from "../framework/flags";
import { refreshLiveModels } from "../framework/auth";

export async function modelsHandler(): Promise<number> {
  const filter = str({} as Record<string, unknown>, "provider");

  // Catalogue Zen rafraîchi depuis la passerelle (la liste statique est périmée).
  await refreshLiveModels();

  const providers = aiProviderRegistry.getAllProviders();
  let total = 0;

  for (const provider of providers) {
    let models: Array<{ id: string; name: string; description?: string; badge?: string; isFree?: boolean }> = [];
    try {
      models = provider.listModels() as typeof models;
    } catch {
      models = [];
    }
    if (!models.length) continue;
    if (filter && String(provider.id).toLowerCase() !== filter.toLowerCase()) continue;

    const isDefault = provider.getDefaultModel();
    println(bold(cyan(`${provider.name} (${provider.id})`)));
    for (const model of models) {
      total++;
      const marker = model.id === isDefault ? green(" ★ default") : "";
      const badge = model.badge ? dim(` [${model.badge}]`) : "";
      const free = model.isFree ? dim(" (free)") : "";
      println(`  ${model.id.padEnd(34)} ${model.name}${badge}${free}${marker}`);
    }
    println("");
  }

  if (total === 0) {
    println("No model found in registry.");
    return EXIT_OK;
  }

  println(dim(`${total} models available.`));
  return EXIT_OK;
}
