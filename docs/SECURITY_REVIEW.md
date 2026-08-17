# SECURITY_REVIEW — Skills e Conteúdo (anti-malicioso)

> Aplicado a TODO skill baixado e TODO anexo ingerido no JETFUEL-SIM.

## 1. Proveniência (fontes confiáveis SOMENTE)
- `supabase/agent-skills` (GitHub oficial) ✅
- `anthropics/skills` (oficial) ✅
- `awesome-claude-skills` / `awesome-cursorrules` (curados, revisar) ⚠
- Discord/Reddit: **não** usar como fonte primária sem verificação cruzada.
- Nunca `curl | bash` de origem desconhecida.

## 2. Inspeção de SKILL.md (checklist)
- [ ] Não executa `rm -rf`, `curl|sh`, `git reset --hard` sem flag de confirmação.
- [ ] Não lê `~/.hermes/.env` ou credenciais alheias.
- [ ] Não faz `eval()` de input do usuário sem sanitização.
- [ ] Comandos de shell parametrizados (sem string interpolation de caminho externo).
- [ ] Não expõe service_role / secret keys.
- [ ] Sem `chmod 777`, `sudo` desnecessário, `:*)` em shell.

## 3. Higienização de anexos (PDF/XLSX)
- PDFs: extrair apenas texto (`read_file`/`pdftotext`); não executar scripts embutidos.
- XLSX: abrir via `openpyxl`/`xlsx` (sem macros); `.xlsm` com macros = quarentena.
- Confirmar que `Mapa novo Atualizado-Model.pdf` (20MB) é imagem/PDF legítimo (sem JS).

## 4. Banco de dados
- Nunca usar a anon key para operações admin.
- RLS obrigatório; revisar policies antes de cada release.
- Backup diário (já existe rotina no repo: `feat: add automated daily backup`).

## 5. Revisão contínua
- Todo novo skill entra em `skills-lock.json` com hash (padrão do repo).
- PR de skill passa por `requesting-code-review` antes de ativar.
