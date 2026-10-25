/**
 * @soryos/tool
 * Codebase Intelligence Tools - Extrait et adapté de Vibra Code
 * 
 * Fonctionnalités:
 * - codebase_search: Recherche sémantique dans le codebase
 * - symbol_search: Recherche de symboles (fonctions, classes, variables)
 * - reference_search: Recherche des références à un symbole
 * - dependency_analysis: Analyse des dépendances
 * - import_analysis: Analyse des imports
 * - code_structure: Analyse de la structure du code
 * - file_dependencies: Dépendances d'un fichier
 * - project_structure: Structure complète du projet
 * 
 * Utilise l'indexation et l'analyse statique pour fournir des résultats intelligents
 */

import { ExecutionProvider } from '@soryos/execution';
import { SessionData } from '@soryos/schema';
import { globalEventBus } from '@soryos/bus';
import { permissionsManager } from '@soryos/permissions';
import { FilesystemTools } from './filesystem-tools';

export interface CodebaseSearchOptions {
  query: string;
  path?: string;
  targetDirectories?: string[];
  maxResults?: number;
  includeDependencies?: boolean;
}

export interface SymbolSearchOptions {
  symbol: string;
  type?: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'any';
  path?: string;
  maxResults?: number;
}

export interface ReferenceSearchOptions {
  symbol: string;
  path?: string;
  maxResults?: number;
}

export interface DependencyAnalysisOptions {
  filePath: string;
  depth?: number;
}

export interface CodebaseToolResult {
  success: boolean;
  results?: any[];
  error?: string;
  metadata?: Record<string, any>;
  verified?: boolean;
}

export interface SymbolInfo {
  name: string;
  type: string;
  filePath: string;
  line: number;
  column: number;
  code: string;
  scope: string;
  references: number;
}

export interface ReferenceInfo {
  filePath: string;
  line: number;
  column: number;
  code: string;
  type: 'definition' | 'reference' | 'import' | 'export';
}

export interface DependencyInfo {
  filePath: string;
  dependencies: string[];
  devDependencies: string[];
  imports: Array<{ path: string; line: number }>;
  exports: string[];
}

/**
 * Codebase Intelligence Tools
 * 
 * Ces outils fournissent une intelligence avancée sur le codebase.
 * Ils utilisent l'analyse statique et l'indexation pour des résultats rapides.
 */
export class CodebaseTools {
  private provider: ExecutionProvider;
  private fsTools: FilesystemTools;
  private symbolIndex: Map<string, SymbolInfo[]> = new Map();
  private fileCache: Map<string, string> = new Map();
  private dependencyCache: Map<string, DependencyInfo> = new Map();

  constructor(provider: ExecutionProvider) {
    this.provider = provider;
    this.fsTools = new FilesystemTools(provider);
  }

  /**
   * Recherche dans le codebase (recherche sémantique ou textuelle)
   * 
   * @param options - Options de recherche
   * @returns Résultats de recherche
   */
  async codebaseSearch(options: CodebaseSearchOptions): Promise<CodebaseToolResult> {
    const callId = `codebase-search-${Date.now()}`;
    const {
      query,
      path = '',
      targetDirectories = [],
      maxResults = 20,
      includeDependencies = false
    } = options;
    
    if (!query) {
      const result: CodebaseToolResult = {
        success: false,
        error: 'Query parameter is required'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'codebase_search', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'codebase_search', options);
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'codebase_search', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'codebase_search', 
        input: options,
        callId 
      });

      const startTime = Date.now();
      
      // Obtenir la liste des fichiers à analyser
      const filesToScan = await this.getFilesToScan(path, targetDirectories);
      
      // Effectuer la recherche
      const results = await this.performCodebaseSearch(
        query,
        filesToScan,
        maxResults,
        includeDependencies
      );
      
      const durationMs = Date.now() - startTime;

      const result: CodebaseToolResult = {
        success: true,
        results,
        metadata: {
          query,
          count: results.length,
          filesScanned: filesToScan.length,
          durationMs
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'codebase_search', 
        output: JSON.stringify(results),
        callId,
        metadata: result.metadata 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'codebase_search', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Codebase search failed: ${errorMessage}`
      };
    }
  }

  /**
   * Rechercher un symbole dans le codebase
   * 
   * @param options - Options de recherche de symbole
   * @returns Informations sur les symboles trouvés
   */
  async symbolSearch(options: SymbolSearchOptions): Promise<CodebaseToolResult> {
    const callId = `symbol-search-${Date.now()}`;
    const {
      symbol,
      type = 'any',
      path = '',
      maxResults = 20
    } = options;
    
    if (!symbol) {
      const result: CodebaseToolResult = {
        success: false,
        error: 'Symbol parameter is required'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'symbol_search', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'symbol_search', options);
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'symbol_search', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'symbol_search', 
        input: options,
        callId 
      });

      const startTime = Date.now();
      
      // Vérifier le cache d'index
      const cacheKey = `${path}:${type}`;
      if (this.symbolIndex.has(cacheKey)) {
        const cachedResults = this.symbolIndex.get(cacheKey)!;
        const filtered = cachedResults.filter(s => 
          s.name.toLowerCase().includes(symbol.toLowerCase())
        );
        
        const result: CodebaseToolResult = {
          success: true,
          results: filtered.slice(0, maxResults),
          metadata: {
            symbol,
            count: filtered.length,
            cached: true,
            durationMs: Date.now() - startTime
          },
          verified: true
        };

        globalEventBus.emit('tool.completed', { 
          toolName: 'symbol_search', 
          output: JSON.stringify(result.results),
          callId,
          metadata: result.metadata 
        });

        return result;
      }
      
      // Indexer les symboles si nécessaire
      await this.indexSymbols(path);
      
      // Rechercher dans l'index
      const allSymbols = this.symbolIndex.get(cacheKey) || [];
      const filtered = allSymbols.filter(s => 
        s.name.toLowerCase().includes(symbol.toLowerCase()) &&
        (type === 'any' || s.type === type)
      );
      
      const result: CodebaseToolResult = {
        success: true,
        results: filtered.slice(0, maxResults),
        metadata: {
          symbol,
          count: filtered.length,
          filesScanned: allSymbols.length,
          durationMs: Date.now() - startTime
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'symbol_search', 
        output: JSON.stringify(result.results),
        callId,
        metadata: result.metadata 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'symbol_search', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Symbol search failed: ${errorMessage}`
      };
    }
  }

  /**
   * Rechercher les références à un symbole
   * 
   * @param options - Options de recherche de références
   * @returns Liste des références
   */
  async referenceSearch(options: ReferenceSearchOptions): Promise<CodebaseToolResult> {
    const callId = `ref-search-${Date.now()}`;
    const {
      symbol,
      path = '',
      maxResults = 50
    } = options;
    
    if (!symbol) {
      const result: CodebaseToolResult = {
        success: false,
        error: 'Symbol parameter is required'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'reference_search', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'reference_search', options);
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'reference_search', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'reference_search', 
        input: options,
        callId 
      });

      const startTime = Date.now();
      
      // Obtenir la liste des fichiers à analyser
      const filesToScan = await this.getFilesToScan(path, []);
      
      // Rechercher les références
      const references = await this.findReferences(symbol, filesToScan, maxResults);
      
      const durationMs = Date.now() - startTime;

      const result: CodebaseToolResult = {
        success: true,
        results: references,
        metadata: {
          symbol,
          count: references.length,
          filesScanned: filesToScan.length,
          durationMs
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'reference_search', 
        output: JSON.stringify(result.results),
        callId,
        metadata: result.metadata 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'reference_search', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Reference search failed: ${errorMessage}`
      };
    }
  }

  /**
   * Analyser les dépendances d'un fichier
   * 
   * @param options - Options d'analyse de dépendances
   * @returns Informations sur les dépendances
   */
  async dependencyAnalysis(options: DependencyAnalysisOptions): Promise<CodebaseToolResult> {
    const callId = `dep-analysis-${Date.now()}`;
    const {
      filePath,
      depth = 1
    } = options;
    
    if (!filePath) {
      const result: CodebaseToolResult = {
        success: false,
        error: 'filePath parameter is required'
      };
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'dependency_analysis', 
        error: result.error,
        callId 
      });
      
      return result;
    }

    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'dependency_analysis', options);
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'dependency_analysis', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'dependency_analysis', 
        input: options,
        callId 
      });

      const startTime = Date.now();
      
      // Vérifier le cache
      if (this.dependencyCache.has(filePath)) {
        const cached = this.dependencyCache.get(filePath)!;
        
        const result: CodebaseToolResult = {
          success: true,
          results: [cached],
          metadata: {
            filePath,
            cached: true,
            durationMs: Date.now() - startTime
          },
          verified: true
        };

        globalEventBus.emit('tool.completed', { 
          toolName: 'dependency_analysis', 
          output: JSON.stringify(result.results),
          callId,
          metadata: result.metadata 
        });

        return result;
      }
      
      // Analyser les dépendances
      const deps = await this.analyzeFileDependencies(filePath, depth);
      
      // Mettre en cache
      this.dependencyCache.set(filePath, deps);
      
      const durationMs = Date.now() - startTime;

      const result: CodebaseToolResult = {
        success: true,
        results: [deps],
        metadata: {
          filePath,
          depth,
          durationMs
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'dependency_analysis', 
        output: JSON.stringify(result.results),
        callId,
        metadata: result.metadata 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'dependency_analysis', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Dependency analysis failed: ${errorMessage}`
      };
    }
  }

  /**
   * Analyser les imports d'un fichier
   * 
   * @param filePath - Chemin du fichier
   * @returns Liste des imports
   */
  async analyzeImports(filePath: string): Promise<CodebaseToolResult> {
    const callId = `import-analysis-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'import_analysis', { filePath });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'import_analysis', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'import_analysis', 
        input: { filePath },
        callId 
      });

      const startTime = Date.now();
      
      // Lire le fichier
      const content = await this.fsTools.readFile(filePath);
      
      if (!content.success) {
        return content;
      }
      
      // Extraire les imports
      const imports = this.extractImports(content.output || '', filePath);
      
      const durationMs = Date.now() - startTime;

      const result: CodebaseToolResult = {
        success: true,
        results: imports,
        metadata: {
          filePath,
          count: imports.length,
          durationMs
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'import_analysis', 
        output: JSON.stringify(result.results),
        callId,
        metadata: result.metadata 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'import_analysis', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Import analysis failed: ${errorMessage}`
      };
    }
  }

  /**
   * Obtenir la structure du code d'un fichier
   * 
   * @param filePath - Chemin du fichier
   * @returns Structure du code
   */
  async codeStructure(filePath: string): Promise<CodebaseToolResult> {
    const callId = `code-structure-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'code_structure', { filePath });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'code_structure', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'code_structure', 
        input: { filePath },
        callId 
      });

      const startTime = Date.now();
      
      // Lire le fichier
      const content = await this.fsTools.readFile(filePath);
      
      if (!content.success) {
        return content;
      }
      
      // Analyser la structure
      const structure = this.analyzeCodeStructure(content.output || '', filePath);
      
      const durationMs = Date.now() - startTime;

      const result: CodebaseToolResult = {
        success: true,
        results: [structure],
        metadata: {
          filePath,
          durationMs
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'code_structure', 
        output: JSON.stringify(result.results),
        callId,
        metadata: result.metadata 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'code_structure', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Code structure analysis failed: ${errorMessage}`
      };
    }
  }

  /**
   * Obtenir la structure complète du projet
   * 
   * @param path - Répertoire racine (optionnel)
   * @returns Structure du projet
   */
  async projectStructure(path: string = ''): Promise<CodebaseToolResult> {
    const callId = `project-structure-${Date.now()}`;
    
    try {
      // Vérifier les permissions
      const perm = permissionsManager.checkPermission('read', 'project_structure', { path });
      if (!perm.allowed) {
        globalEventBus.emit('permission.denied', { 
          toolName: 'project_structure', 
          reason: perm.reason,
          callId 
        });
        return {
          success: false,
          error: `PERMISSION DENIED: ${perm.reason}`
        };
      }

      globalEventBus.emit('tool.started', { 
        toolName: 'project_structure', 
        input: { path },
        callId 
      });

      const startTime = Date.now();
      
      // Lister les fichiers
      const listResult = await this.fsTools.listFiles(path, true, true);
      
      if (!listResult.success) {
        return listResult;
      }
      
      // Analyser la structure
      const structure = this.buildProjectStructure(listResult.output || '');
      
      const durationMs = Date.now() - startTime;

      const result: CodebaseToolResult = {
        success: true,
        results: [structure],
        metadata: {
          path,
          durationMs
        },
        verified: true
      };

      globalEventBus.emit('tool.completed', { 
        toolName: 'project_structure', 
        output: JSON.stringify(result.results),
        callId,
        metadata: result.metadata 
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      globalEventBus.emit('tool.failed', { 
        toolName: 'project_structure', 
        error: errorMessage,
        callId 
      });

      return {
        success: false,
        error: `Project structure analysis failed: ${errorMessage}`
      };
    }
  }

  /**
   * Obtenir les fichiers à analyser
   */
  private async getFilesToScan(path: string, targetDirectories: string[]): Promise<string[]> {
    const files: string[] = [];
    
    if (targetDirectories.length > 0) {
      // Analyser uniquement les répertoires cibles
      for (const dir of targetDirectories) {
        const listResult = await this.fsTools.listFiles(dir, true, false);
        if (listResult.success && listResult.output) {
          const dirFiles = this.parseFileList(listResult.output);
          files.push(...dirFiles);
        }
      }
    } else {
      // Analyser tout le workspace
      const listResult = await this.fsTools.listFiles(path, true, false);
      if (listResult.success && listResult.output) {
        const allFiles = this.parseFileList(listResult.output);
        files.push(...allFiles);
      }
    }
    
    // Filtrer les fichiers pertinents
    return files.filter(f => this.isRelevantFile(f));
  }

  /**
   * Analyser le contenu d'un fichier et extraire les imports
   */
  private parseFileList(output: string): string[] {
    const lines = output.split('\n');
    const files: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[DIR]')) {
        continue;
      }
      if (trimmed && !trimmed.startsWith('Found')) {
        // Extraire le chemin du fichier
        const match = trimmed.match(/^\s+(.+?)\s*\(/);
        if (match) {
          files.push(match[1]);
        }
      }
    }
    
    return files;
  }

  /**
   * Vérifier si un fichier est pertinent pour l'analyse
   */
  private isRelevantFile(filePath: string): boolean {
    const relevantExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.pyx',
      '.go',
      '.rs',
      '.java', '.kt', '.scala',
      '.cpp', '.h', '.hpp', '.cc', '.cxx',
      '.php',
      '.rb',
      '.swift',
      '.json', '.yaml', '.yml', '.toml', '.xml'
    ];
    
    const excludedDirs = ['node_modules', '.git', 'dist', 'build', 'target', 'tmp', 'temp'];
    
    // Exclure les répertoires
    if (excludedDirs.some(dir => filePath.includes(`/${dir}/`) || filePath === dir)) {
      return false;
    }
    
    // Inclure les fichiers avec extensions pertinentes
    return relevantExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Effectuer une recherche dans le codebase
   */
  private async performCodebaseSearch(
    query: string,
    files: string[],
    maxResults: number,
    includeDependencies: boolean
  ): Promise<any[]> {
    const results: any[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const filePath of files) {
      if (results.length >= maxResults) break;
      
      try {
        // Utiliser le cache si disponible
        let content = this.fileCache.get(filePath);
        if (!content) {
          const readResult = await this.fsTools.readFile(filePath);
          if (readResult.success && readResult.output) {
            content = readResult.output;
            this.fileCache.set(filePath, content);
          }
        }
        
        if (!content) continue;
        
        // Rechercher dans le contenu
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          const line = lines[i];
          const lowerLine = line.toLowerCase();
          
          if (lowerLine.includes(lowerQuery)) {
            results.push({
              filePath,
              line: i + 1,
              column: lowerLine.indexOf(lowerQuery) + 1,
              code: line.trim(),
              context: this.getSurroundingLines(lines, i, 2)
            });
          }
        }
      } catch (error) {
        console.error(`[CodebaseTools] Error searching file ${filePath}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Obtenir les lignes autour d'une ligne donnée
   */
  private getSurroundingLines(lines: string[], currentIndex: number, radius: number): string[] {
    const start = Math.max(0, currentIndex - radius);
    const end = Math.min(lines.length - 1, currentIndex + radius);
    
    return lines.slice(start, end + 1).map((line, idx) => 
      `${start + idx + 1}: ${line}`
    );
  }

  /**
   * Indexer les symboles dans les fichiers
   */
  private async indexSymbols(path: string): Promise<void> {
    const files = await this.getFilesToScan(path, []);
    const symbols: SymbolInfo[] = [];
    
    for (const filePath of files) {
      try {
        let content = this.fileCache.get(filePath);
        if (!content) {
          const readResult = await this.fsTools.readFile(filePath);
          if (readResult.success && readResult.output) {
            content = readResult.output;
            this.fileCache.set(filePath, content);
          }
        }
        
        if (!content) continue;
        
        // Extraire les symboles
        const fileSymbols = this.extractSymbols(content, filePath);
        symbols.push(...fileSymbols);
      } catch (error) {
        console.error(`[CodebaseTools] Error indexing symbols in ${filePath}:`, error);
      }
    }
    
    // Stocker dans l'index
    this.symbolIndex.set(path, symbols);
  }

  /**
   * Extraire les symboles d'un fichier
   */
  private extractSymbols(content: string, filePath: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');
    
    // Patterns pour détecter différents types de symboles
    const patterns = [
      // TypeScript/JavaScript
      { type: 'function', pattern: /(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g },
      { type: 'class', pattern: /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g },
      { type: 'interface', pattern: /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g },
      { type: 'type', pattern: /type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g },
      { type: 'variable', pattern: /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[=;]/g },
      
      // Python
      { type: 'function', pattern: /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g },
      { type: 'class', pattern: /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g },
      { type: 'variable', pattern: /([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g },
      
      // Rust
      { type: 'function', pattern: /fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g },
      { type: 'struct', pattern: /struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/g },
      { type: 'enum', pattern: /enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/g },
      
      // Go
      { type: 'function', pattern: /func\s+[^(]*\([^)]*\)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g },
      { type: 'struct', pattern: /type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+struct/g },
      
      // Java
      { type: 'class', pattern: /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g },
      { type: 'interface', pattern: /interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/g },
      { type: 'method', pattern: /(?:public|private|protected)\s+(?:static\s+)?[a-zA-Z_\s]+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g }
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.pattern.exec(content)) !== null) {
        const symbolName = match[1];
        const line = content.substring(0, match.index).split('\n').length;
        const column = match.index - content.substring(0, match.index).lastIndexOf('\n') + 1;
        
        // Vérifier si le symbole existe déjà
        const existing = symbols.find(s => 
          s.name === symbolName && 
          s.filePath === filePath &&
          s.line === line
        );
        
        if (!existing) {
          symbols.push({
            name: symbolName,
            type: pattern.type,
            filePath,
            line,
            column,
            code: match[0],
            scope: this.determineScope(content, line, symbolName),
            references: 0
          });
        }
      }
    }
    
    return symbols;
  }

  /**
   * Déterminer la portée d'un symbole
   */
  private determineScope(content: string, line: number, symbol: string): string {
    const lines = content.split('\n');
    const currentLine = lines[line - 1] || '';
    
    // Vérifier si c'est une exportation
    if (currentLine.includes('export ') || currentLine.includes('export default')) {
      return 'exported';
    }
    
    // Vérifier si c'est une déclaration publique
    if (currentLine.includes('public ') || currentLine.includes(' class ') || 
        currentLine.includes(' interface ') || currentLine.includes(' type ')) {
      return 'public';
    }
    
    // Vérifier si c'est une déclaration privée
    if (currentLine.includes('private ') || currentLine.includes('_')) {
      return 'private';
    }
    
    return 'local';
  }

  /**
   * Trouver les références à un symbole
   */
  private async findReferences(
    symbol: string,
    files: string[],
    maxResults: number
  ): Promise<ReferenceInfo[]> {
    const references: ReferenceInfo[] = [];
    
    for (const filePath of files) {
      if (references.length >= maxResults) break;
      
      try {
        let content = this.fileCache.get(filePath);
        if (!content) {
          const readResult = await this.fsTools.readFile(filePath);
          if (readResult.success && readResult.output) {
            content = readResult.output;
            this.fileCache.set(filePath, content);
          }
        }
        
        if (!content) continue;
        
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length && references.length < maxResults; i++) {
          const line = lines[i];
          
          // Vérifier si la ligne contient le symbole
          if (line.includes(symbol)) {
            // Déterminer le type de référence
            let refType: ReferenceInfo['type'] = 'reference';
            
            if (line.trim().startsWith('import ') || line.trim().startsWith('require(')) {
              refType = 'import';
            } else if (line.trim().startsWith('export ') || line.trim().startsWith('export default')) {
              refType = 'export';
            } else if (this.isDefinition(line, symbol)) {
              refType = 'definition';
            }
            
            references.push({
              filePath,
              line: i + 1,
              column: line.indexOf(symbol) + 1,
              code: line.trim(),
              type: refType
            });
          }
        }
      } catch (error) {
        console.error(`[CodebaseTools] Error finding references in ${filePath}:`, error);
      }
    }
    
    return references;
  }

  /**
   * Vérifier si une ligne est une définition
   */
  private isDefinition(line: string, symbol: string): boolean {
    const definitionPatterns = [
      /(?:function|const|let|var|class|interface|type|def|fn|struct|enum)\s+/,
      /^\s*(?:public|private|protected)\s+/,
      /^\s*export\s+/,
      /=/,
      /:/
    ];
    
    return definitionPatterns.some(pattern => {
      const match = line.match(pattern);
      if (match) {
        const beforeSymbol = line.substring(0, line.indexOf(symbol));
        return beforeSymbol.includes(match[0]);
      }
      return false;
    });
  }

  /**
   * Analyser les dépendances d'un fichier
   */
  private async analyzeFileDependencies(filePath: string, depth: number): Promise<DependencyInfo> {
    const deps: DependencyInfo = {
      filePath,
      dependencies: [],
      devDependencies: [],
      imports: [],
      exports: []
    };
    
    try {
      const content = await this.fsTools.readFile(filePath);
      if (!content.success || !content.output) return deps;
      
      // Extraire les imports
      deps.imports = this.extractImports(content.output, filePath);
      
      // Extraire les exports
      deps.exports = this.extractExports(content.output);
      
      // Analyser les dépendances (pour package.json, etc.)
      if (filePath.endsWith('package.json')) {
        const parsed = JSON.parse(content.output);
        deps.dependencies = Object.keys(parsed.dependencies || {});
        deps.devDependencies = Object.keys(parsed.devDependencies || {});
      }
      
      // Si depth > 1, analyser les dépendances des dépendances
      if (depth > 1) {
        for (const importPath of deps.imports.map(i => i.path)) {
          if (importPath.startsWith('.') && !importPath.startsWith('node_modules')) {
            const childDeps = await this.analyzeFileDependencies(importPath, depth - 1);
            deps.dependencies.push(...childDeps.dependencies);
            deps.devDependencies.push(...childDeps.devDependencies);
          }
        }
      }
      
    } catch (error) {
      console.error(`[CodebaseTools] Error analyzing dependencies for ${filePath}:`, error);
    }
    
    return deps;
  }

  /**
   * Extraire les imports d'un fichier
   */
  private extractImports(content: string, filePath: string): Array<{ path: string; line: number }> {
    const imports: Array<{ path: string; line: number }> = [];
    const lines = content.split('\n');
    
    // Patterns pour différents types d'imports
    const importPatterns = [
      // TypeScript/ES6 imports
      { pattern: /^\s*import\s+[^'"\s]+\s+from\s+['"]([^'"]+)['"]/g, type: 'es6' },
      { pattern: /^\s*import\s+\*\s+as\s+[^\s]+\s+from\s+['"]([^'"]+)['"]/g, type: 'es6' },
      { pattern: /^\s*import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, type: 'es6' },
      { pattern: /^\s*import\s+['"]([^'"]+)['"]/g, type: 'es6' },
      
      // CommonJS requires
      { pattern: /^\s*const\s+[^\s]+\s*=\s*require\(['"]([^'"]+)['"]\)/g, type: 'commonjs' },
      { pattern: /^\s*var\s+[^\s]+\s*=\s*require\(['"]([^'"]+)['"]\)/g, type: 'commonjs' },
      { pattern: /^\s*let\s+[^\s]+\s*=\s*require\(['"]([^'"]+)['"]\)/g, type: 'commonjs' },
      
      // Python imports
      { pattern: /^\s*from\s+([^\s]+)\s+import/g, type: 'python' },
      { pattern: /^\s*import\s+([^\s,]+)/g, type: 'python' },
      
      // Rust uses
      { pattern: /^\s*use\s+([^;]+)/g, type: 'rust' },
      
      // Go imports
      { pattern: /^\s*import\s+\(/g, type: 'go' },
      { pattern: /"([^"]+)"/g, type: 'go' }
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of importPatterns) {
        let match;
        while ((match = pattern.pattern.exec(line)) !== null) {
          let importPath = match[1];
          
          // Nettoyer le chemin
          importPath = importPath.trim().replace(/['"]/g, '');
          
          // Résoudre les chemins relatifs
          if (importPath.startsWith('.')) {
            importPath = this.resolveRelativePath(filePath, importPath);
          }
          
          // Vérifier si l'import existe déjà
          const existing = imports.find(imp => imp.path === importPath);
          if (!existing) {
            imports.push({
              path: importPath,
              line: i + 1
            });
          }
        }
      }
    }
    
    return imports;
  }

  /**
   * Résoudre un chemin relatif
   */
  private resolveRelativePath(filePath: string, relativePath: string): string {
    const fileDir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
    
    // Gérer les ..
    let resolved = relativePath;
    while (resolved.startsWith('../')) {
      resolved = resolved.substring(3);
      const lastSlash = fileDir.substring(0, fileDir.length - 1).lastIndexOf('/');
      if (lastSlash === -1) break;
    }
    
    return fileDir + resolved;
  }

  /**
   * Extraire les exports d'un fichier
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // ES6 exports
      if (line.includes('export ') && !line.includes('import ')) {
        const match = line.match(/export\s+(?:const|let|var|function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (match) {
          exports.push(match[1]);
        }
      }
      
      // Default export
      if (line.includes('export default')) {
        const match = line.match(/export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (match) {
          exports.push(`default (${match[1]})`);
        } else {
          exports.push('default');
        }
      }
      
      // CommonJS exports
      if (line.includes('module.exports')) {
        const match = line.match(/module\.exports\s*=\s*([^;]+)/);
        if (match) {
          exports.push(`module.exports (${match[1]})`);
        } else {
          exports.push('module.exports');
        }
      }
      
      // Named exports
      if (line.includes('exports.')) {
        const match = line.match(/exports\.([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (match) {
          exports.push(match[1]);
        }
      }
    }
    
    return exports;
  }

  /**
   * Analyser la structure du code
   */
  private analyzeCodeStructure(content: string, filePath: string): any {
    const structure: any = {
      filePath,
      type: this.detectFileType(filePath),
      classes: [],
      functions: [],
      variables: [],
      interfaces: [],
      types: [],
      imports: [],
      exports: []
    };
    
    // Extraire les imports
    structure.imports = this.extractImports(content, filePath);
    
    // Extraire les exports
    structure.exports = this.extractExports(content);
    
    // Extraire les symboles
    const symbols = this.extractSymbols(content, filePath);
    
    for (const symbol of symbols) {
      if (symbol.type === 'class') {
        structure.classes.push({
          name: symbol.name,
          line: symbol.line,
          scope: symbol.scope
        });
      } else if (symbol.type === 'function') {
        structure.functions.push({
          name: symbol.name,
          line: symbol.line,
          scope: symbol.scope
        });
      } else if (symbol.type === 'variable') {
        structure.variables.push({
          name: symbol.name,
          line: symbol.line,
          scope: symbol.scope
        });
      } else if (symbol.type === 'interface') {
        structure.interfaces.push({
          name: symbol.name,
          line: symbol.line,
          scope: symbol.scope
        });
      } else if (symbol.type === 'type') {
        structure.types.push({
          name: symbol.name,
          line: symbol.line,
          scope: symbol.scope
        });
      }
    }
    
    return structure;
  }

  /**
   * Détecter le type de fichier
   */
  private detectFileType(filePath: string): string {
    if (filePath.endsWith('.tsx')) return 'React TypeScript';
    if (filePath.endsWith('.ts')) return 'TypeScript';
    if (filePath.endsWith('.jsx')) return 'React JavaScript';
    if (filePath.endsWith('.js')) return 'JavaScript';
    if (filePath.endsWith('.py')) return 'Python';
    if (filePath.endsWith('.rs')) return 'Rust';
    if (filePath.endsWith('.go')) return 'Go';
    if (filePath.endsWith('.java')) return 'Java';
    if (filePath.endsWith('.kt')) return 'Kotlin';
    if (filePath.endsWith('.scala')) return 'Scala';
    if (filePath.endsWith('.cpp') || filePath.endsWith('.h') || filePath.endsWith('.hpp') || filePath.endsWith('.cc') || filePath.endsWith('.cxx')) return 'C++';
    if (filePath.endsWith('.c')) return 'C';
    if (filePath.endsWith('.php')) return 'PHP';
    if (filePath.endsWith('.rb')) return 'Ruby';
    if (filePath.endsWith('.swift')) return 'Swift';
    if (filePath.endsWith('.json')) return 'JSON';
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'YAML';
    if (filePath.endsWith('.toml')) return 'TOML';
    if (filePath.endsWith('.xml')) return 'XML';
    
    return 'Unknown';
  }

  /**
   * Construire la structure du projet
   */
  private buildProjectStructure(output: string): any {
    const lines = output.split('\n');
    const structure: any = {
      directories: [],
      files: [],
      summary: {
        totalFiles: 0,
        totalDirectories: 0,
        byType: {} as Record<string, number>
      }
    };
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('[DIR]')) {
        const dirName = trimmed.substring(5).trim().split(' ')[0];
        structure.directories.push(dirName);
        structure.summary.totalDirectories++;
      } else if (trimmed && !trimmed.startsWith('Found')) {
        const match = trimmed.match(/^\s+(.+?)\s*\(/);
        if (match) {
          const filePath = match[1];
          structure.files.push(filePath);
          structure.summary.totalFiles++;
          
          // Classer par type
          const fileType = this.detectFileType(filePath);
          structure.summary.byType[fileType] = (structure.summary.byType[fileType] || 0) + 1;
        }
      }
    }
    
    return structure;
  }

  /**
   * Obtenir le provider actuel
   */
  getProvider(): ExecutionProvider {
    return this.provider;
  }

  /**
   * Mettre à jour le provider
   */
  setProvider(provider: ExecutionProvider): void {
    this.provider = provider;
    this.fsTools.setProvider(provider);
  }

  /**
   * Effacer le cache
   */
  clearCache(): void {
    this.fileCache.clear();
    this.dependencyCache.clear();
    this.symbolIndex.clear();
  }
}

/**
 * Créer une instance des Codebase Tools
 */
export function createCodebaseTools(provider: ExecutionProvider): CodebaseTools {
  return new CodebaseTools(provider);
}
