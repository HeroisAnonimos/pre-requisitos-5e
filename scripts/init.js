
Hooks.once('init', async function () {
  game.settings.register('pre-requisitos-5e', 'enablePreRequisitos', {
    name: 'Ativar Pré-requisitos de Características',
    hint: 'Se ativado, os pré-requisitos para características de classe serão verificados.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: value => window.location.reload()
  });
});

const language = 'pt-BR'; // Isso pode ser dinâmico, baseado na configuração do usuário
const translations = require(`../lang/${language}.json`);

console.log(translations.module_name); 

Hooks.on('dnd5e.preLevelUp', async (actor, className, level) => {
  if (game.settings.get('pre-requisitos-5e', 'enablePreRequisitos')) {
    try {
      await verificarPreRequisitos(actor, className, level);
    } catch (error) {
      console.error('Erro na verificação:', error);
      ui.notifications.error('Falha na verificação de pré-requisitos');
      return false;
    }
  }
});

Hooks.on('renderAdvancementConfig', (app, html, data) => {
  // Garantir que o foco está na aba de avanço de class

  console.log(app, app.item, app.item.flags);
  const preRequisitos = app.item?.flags['pre-requisitos-5e']['pre-requisitos'] || '';
  const preRequisitosHtml = `
    <div class="form-group">
      <label>Esferas ou Aptidões Necessarias (Insira as UUIDs diretamente)</label>
      <textarea class="pre-requisitos-input" style="width: 100%; min-height: 50px;">${preRequisitos}</textarea>
      <button type="button" class="save-pre-requisitos">Salvar Pré-requisitos</button>
    </div>
  `;
  console.log(preRequisitos, preRequisitosHtml);
  const classRestrictionElement = html.find('select[name="classRestriction"]');
  const advancementTab = html.find('.tabs[data-group="primary"] a[data-tab="advancement"]');
  if (advancementTab.length > 0) {
    advancementTab.trigger('click');
  }
  if (classRestrictionElement.length > 0) {
    classRestrictionElement.closest('.form-group').after(preRequisitosHtml);
  }

  html.find('.save-pre-requisitos').on('click', async () => {
    const preRequisitos = html.find('.pre-requisitos-input').val().trim();
    console.log ("===========1", preRequisitos,app);
    if (preRequisitos !== undefined) {
      try {
        // TODO: verificar && app.item instanceof foundry.documents.BaseDocument
        // Right-hand side of 'instanceof' is not an object
        if (app.item && typeof app.item.setFlag === 'function') {
          await app.item.setFlag('pre-requisitos-5e', 'pre-requisitos', preRequisitos);
          ui.notifications.info('Pré-requisitos salvos com sucesso.');
          //app.render(false);
        } else {
          console.error('Advancement não é válido ou método setFlag não está disponível para:', app.item);
          ui.notifications.error('Advancement não encontrado ou método setFlag indisponível. Verifique se o advancement é do tipo correto.');
        }
      } catch (error) {
        console.error('Erro ao salvar os pré-requisitos:', error);
        ui.notifications.error('Erro ao salvar os pré-requisitos. Verifique o console para mais detalhes.');
      }
    }
  });
});

Hooks.on('renderAdvancementSelection', (app, html, data) => {
  // Garantir que estamos na aba correta de seleção de avanço
  const advancementOptions = html.find('.advancement-options');
  if (advancementOptions.length > 0) {
    const preRequisitos = data.object?.flags?.['pre-requisitos-5e']?.preRequisitos || '';
    const requisitosHtml = `
      <div class="form-group">
        <label>Pré-requisitos Atuais:</label>
        <ul class="pre-requisitos-list">
          ${preRequisitos.split(',').map(req => `<li data-uuid="${req}">${req}</li>`).join('')}
        </ul>
      </div>
    `;
    advancementOptions.append(requisitosHtml);
    const advancementTab = html.find('.tabs[data-group="primary"] a[data-tab="advancement"]');
    if (advancementTab.length > 0) {
      advancementTab.trigger('click');
    }
  }
});

Hooks.on('closeAdvancementConfig', async (app, html) => {
  const preRequisitos = html.find('.pre-requisitos-input').val().trim();
  if (preRequisitos !== undefined) {
    try {
      //TODO: && app.object instanceof foundry.documents.BaseDocument 
      if (app.item && typeof app.item.setFlag === 'function') {
        await app.item.setFlag('pre-requisitos-5e', 'pre-requisitos', preRequisitos);
      } else {
        console.error('Advancement não é válido ou método setFlag não está disponível para:', app.item);
        ui.notifications.error('Advancement não encontrado ou método setFlag indisponível. Verifique se o advancement é do tipo correto.');
      }
    } catch (error) {
      console.error('Erro ao salvar os pré-requisitos:', error);
      ui.notifications.error('Erro ao salvar os pré-requisitos. Verifique o console para mais detalhes.');
    }
  }
});

// Correto uso da API do Foundry
game.settings.register('pre-requisitos-5e', 'enablePreRequisitos', {
  scope: 'world',  // Configuração em nível de mundo
  config: true,    // Visível na interface
  type: Boolean    // Tipo de dado correto
});

async function verificarPreRequisitos(actor, className, level) {
  // Correto uso da API do DND5E
  const caracteristicasDisponiveis = CONFIG.DND5E.featureTypes.class;
  const caracteristicasComPreRequisitos = [];
  for (const caracteristica of caracteristicasDisponiveis) {
    if (await cumprePreRequisitos(actor, caracteristica)) {
      caracteristicasComPreRequisitos.push(caracteristica);
    }
  }
  if (caracteristicasComPreRequisitos.length === 0) {
    ui.notifications.warn('Você não cumpre os pré-requisitos para adquirir nenhuma das características disponíveis. Considere obter os pré-requisitos necessários.');
    return;
  }
}async function cumprePreRequisitos(actor, caracteristica) {
  const preRequisitos = caracteristica.flags?.['pre-requisitos-5e']?.preRequisitos;
  if (!preRequisitos) {
    return true;
  }
  const requisitos = preRequisitos.split(',').map(req => req.trim());
  for (let requisito of requisitos) {
    if (requisito.startsWith('Compendium.')) {
      try {
        const item = await fromUuid(requisito);
        if (!item) {
          return false;
        }
        if (!actor.items.some(i => i.uuid === item.uuid || i.name === item.name)) {
          return false;
        }
      } catch (error) {
        console.error('Erro ao verificar o item do compêndio:', error);
        return false;
      }
    } else if (requisito.includes('>=')) {
      const [atributo, valor] = requisito.split(' >= ');
      if (actor.system.abilities[atributo.toLowerCase()].value < parseInt(valor)) return false;
    } else {
      if (!actor.items.some(i => i.type === 'feature' && i.name === requisito)) return false;
    }
  }
  return true;
}



