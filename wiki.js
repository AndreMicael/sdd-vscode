// @ts-check
// Textos da wiki da feature (página aberta pelo botão direito → "Wiki da feature").
// Só conteúdo: quem monta o HTML é extension.js.

/** Uma entrada por passo do fluxo, na mesma ordem e com as mesmas chaves de lib.trilha(). */
const PASSOS = {
  specify: {
    comando: "speckit-specify",
    resumo: "Escrever O QUE a feature faz e POR QUE, do ponto de vista de quem usa.",
    explicacao:
      "É o ponto de partida. Você descreve a necessidade em linguagem de negócio e a IA transforma isso numa especificação: histórias de usuário, requisitos numerados (FR-001…), critérios de aceite e o que fica fora do escopo. Aqui não se fala de tecnologia — nada de React, endpoint ou tabela. Se a spec estiver boa, qualquer pessoa do time (inclusive quem não programa) entende o que vai ser entregue.",
    gera: ["spec.md", "checklists/requirements.md (validação automática da spec)"],
    quando: "Sempre. Toda feature começa aqui.",
    dicas: [
      "Descreva o problema e quem sofre com ele, não a solução técnica.",
      "Inclua exemplos concretos: “o cidadão com contrato em atraso quer…”.",
      "Leia a spec gerada inteira. Se algo não é o que você quis, peça ajuste agora — é o momento mais barato para corrigir.",
      "Marcas [NEEDS CLARIFICATION] na spec são dúvidas que a IA não quis inventar. Resolva no passo 2.",
    ],
    erros: [
      "Colocar tecnologia na descrição (“criar endpoint POST /x”). Isso vai para o plano.",
      "Aceitar a spec sem ler. Tudo o que vem depois é construído em cima dela.",
    ],
  },
  clarify: {
    comando: "speckit-clarify",
    resumo: "A IA faz até 5 perguntas sobre o que ficou ambíguo e grava as respostas na spec.",
    explicacao:
      "A IA relê a spec procurando lacunas: regras de negócio sem definição, casos de erro esquecidos, limites (“quantas parcelas no máximo?”), permissões. Ela pergunta uma coisa de cada vez, normalmente com opções, e anota cada resposta numa seção “## Clarifications” da própria spec. É opcional, mas evita que o plano seja feito em cima de suposições.",
    gera: ["Seção “## Clarifications” dentro de spec.md"],
    quando: "Recomendado sempre que a spec tiver [NEEDS CLARIFICATION] ou mexer com dinheiro, regra de negócio ou integração externa. Pode pular em mudanças pequenas e óbvias.",
    dicas: [
      "Se não souber a resposta, diga isso — é melhor levar a dúvida para o PO do que chutar.",
      "Pode rodar mais de uma vez.",
    ],
    erros: ["Pular e deixar a IA “decidir” regra de negócio no plano."],
  },
  plan: {
    comando: "speckit-plan",
    resumo: "Decidir COMO construir: tecnologia, arquivos, dados e contratos de API.",
    explicacao:
      "Agora sim entra a técnica. A IA lê a spec e a constituição do projeto (.specify/memory/constitution.md — as regras que todo código deve seguir) e produz o plano: stack usada, estrutura de pastas, modelo de dados, contratos das APIs e como testar. Ela também verifica se o plano respeita a constituição (“Constitution Check”) e registra pesquisas e decisões técnicas.",
    gera: ["plan.md", "research.md (decisões e alternativas)", "data-model.md", "contracts/ (APIs)", "quickstart.md (como testar)"],
    quando: "Sempre, depois que a spec estiver aprovada.",
    dicas: [
      "Use o campo de instruções para dar contexto técnico: “usar o proxyBackend existente”, “sem nova dependência”.",
      "Confira o Constitution Check: se aparecer violação, ela precisa de justificativa ou o plano precisa mudar.",
      "Se a feature mexe no frontend e no backend, cada repositório tem a sua spec e o seu plano.",
    ],
    erros: ["Mudar o escopo no plano. Se mudou o “o quê”, volte e ajuste a spec."],
  },
  tasks: {
    comando: "speckit-tasks",
    resumo: "Quebrar o plano numa lista de tarefas pequenas e ordenadas (T001, T002…).",
    explicacao:
      "A IA transforma o plano em tarefas concretas, cada uma com um caminho de arquivo e um tamanho que cabe numa sessão de trabalho. As tarefas vêm agrupadas por fase (preparação, base, uma fase por história de usuário, acabamento). As marcadas com [P] podem ser feitas em paralelo porque mexem em arquivos diferentes. Depois deste passo, dá para enviar as tarefas ao ClickUp.",
    gera: ["tasks.md"],
    quando: "Sempre, depois do plano.",
    dicas: [
      "Cada história de usuário deve virar algo que se pode testar sozinho — é o que permite entregar em partes.",
      "Depois de gerar, use “Enviar ao ClickUp” para criar a tarefa-mãe e as subtarefas.",
    ],
    erros: ["Editar tasks.md à mão mudando o escopo sem atualizar spec/plano."],
  },
  analyze: {
    comando: "speckit-analyze",
    resumo: "Conferir se spec, plano e tarefas contam a mesma história. Não altera nada.",
    explicacao:
      "É uma revisão automática e somente leitura. A IA cruza os três documentos procurando requisito sem tarefa, tarefa sem requisito, termos usados com sentidos diferentes, contradições e violações da constituição. Devolve um relatório com a gravidade de cada problema — você decide o que corrigir.",
    gera: ["Nada em disco: o relatório aparece no terminal."],
    quando: "Recomendado antes de implementar, principalmente em features médias ou grandes.",
    dicas: ["Problemas CRITICAL devem ser resolvidos antes do Implementar."],
    erros: ["Ignorar o relatório e descobrir a inconsistência no meio da implementação."],
  },
  implement: {
    comando: "speckit-implement",
    resumo: "A IA executa as tarefas do tasks.md, uma a uma, marcando [X] nas concluídas.",
    explicacao:
      "A IA segue as tarefas na ordem, respeitando as fases e dependências, escreve o código e marca cada tarefa como feita no tasks.md. O progresso aparece aqui na wiki e no painel “Onde estou”. Você pode limitar o escopo pelas instruções, por exemplo “só a Fase 1” — ótimo para revisar aos poucos.",
    gera: ["Código no repositório", "tasks.md atualizado com [X]"],
    quando: "Depois de tasks (e, idealmente, de analyze).",
    dicas: [
      "Implemente por fase e revise o diff (git diff) a cada fase.",
      "Rode lint, tsc e o app entre as fases.",
      "Se a IA travar ou errar, pare, ajuste e rode de novo: as tarefas já marcadas não são refeitas.",
    ],
    erros: ["Rodar tudo de uma vez e só olhar o resultado no final."],
  },
  converge: {
    comando: "speckit-converge",
    resumo: "Conferir o que ainda falta, fechar a feature e abrir o PR.",
    explicacao:
      "Compara o código que existe com a spec, o plano e as tarefas. Se algo ficou para trás, acrescenta tarefas novas ao tasks.md para o Implementar terminar. Quando estiver tudo certo, é hora de abrir o PR (com o link da tarefa do ClickUp e o caminho da spec) e passar pela revisão.",
    gera: ["Novas tarefas em tasks.md, se faltar algo"],
    quando: "Quando todas as tarefas estiverem marcadas.",
    dicas: [
      "No PR, cite specs/<feature>/spec.md e os critérios de aceite demonstrados.",
      "Atualize o status no ClickUp com “Enviar ao ClickUp”.",
    ],
    erros: ["Abrir o PR sem conferir se todos os requisitos da spec foram atendidos."],
  },
};

/** Termos que aparecem no fluxo. */
const GLOSSARIO = [
  ["SDD", "Spec-Driven Development: primeiro se escreve e aprova a especificação, depois o código. A spec é a fonte da verdade."],
  ["Spec Kit", "Ferramenta do GitHub (comando `specify`) que organiza o SDD: cria a pasta .specify/, os modelos e os comandos /speckit-* para a IA."],
  ["Constituição", "Arquivo .specify/memory/constitution.md com as regras do projeto que toda feature deve respeitar. O plano é conferido contra ela."],
  ["Feature", "Uma pasta em specs/ (ex.: 001-comprovante-pix) com todos os documentos de uma entrega, e uma branch git com o mesmo nome."],
  ["História de usuário", "“Como <quem>, quero <o quê>, para <por quê>”. Cada uma deve poder ser entregue e testada sozinha."],
  ["Requisito (FR-001)", "Algo que o sistema DEVE fazer, escrito de forma verificável."],
  ["Critério de aceite", "Condição objetiva para considerar a história pronta (“dado… quando… então…”)."],
  ["[NEEDS CLARIFICATION]", "Marca deixada na spec quando a IA não tinha informação para decidir. Resolve-se no Esclarecer."],
  ["[P]", "Tarefa que pode ser feita em paralelo com outras, porque mexe em arquivos diferentes."],
  ["Integração", "A ligação do Spec Kit com uma IA (Claude, Cursor, Codex…). Cada uma tem os seus comandos instalados no repositório."],
];

module.exports = { PASSOS, GLOSSARIO };
