Hooks.once('init', async function() {
  game.settings.register('pre-requisitos-5e', 'enablePreRequisitos', {
    name: 'Ativar Pré-requisitos de Características',
    hint: 'Se ativado, os pré-requisitos para características de classe serão verificados.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: value => window.location.reload()
  });

  Hooks.on('dnd5e.preLevelUp', async (actor, className, level) => {
    if (game.settings.get('pre-requisitos-5e', 'enablePreRequisitos')) {
      await verificarPreRequisitos(actor, className, level);
    }
  });

  Hooks.on('renderAdvancementConfig', (app, html, data) => {
    // Garantir que o foco está na aba de avanço de classe
    const preRequisitos = data.object?.flags?.['pre-requisitos-5e']?.preRequisitos || '';
    const preRequisitosHtml = `
      <div class="form-group">
        <label>Esferas ou Aptidões Requeridas (Insira as UUIDs diretamente)</label>
        <textarea class="pre-requisitos-input" style="width: 100%; min-height: 50px;">${preRequisitos}</textarea>
        <button type="button" class="save-pre-requisitos">Salvar Pré-requisitos</button>
      </div>
    `;
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
      if (preRequisitos !== undefined) {
        try {
          if (app.object && app.object instanceof foundry.documents.BaseDocument && typeof app.object.setFlag === 'function') {
            await app.object.setFlag('pre-requisitos-5e', 'preRequisitos', preRequisitos);
            ui.notifications.info('Pré-requisitos salvos com sucesso.');
          } else {
            console.error('Advancement não é válido ou método setFlag não está disponível para:', app.object);
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
        if (app.object && app.object instanceof foundry.documents.BaseDocument && typeof app.object.setFlag === 'function') {
          await app.object.setFlag('pre-requisitos-5e', 'preRequisitos', preRequisitos);
        } else {
          console.error('Advancement não é válido ou método setFlag não está disponível para:', data.object);
          ui.notifications.error('Advancement não encontrado ou método setFlag indisponível. Verifique se o advancement é do tipo correto.');
        }
      } catch (error) {
        console.error('Erro ao salvar os pré-requisitos:', error);
        ui.notifications.error('Erro ao salvar os pré-requisitos. Verifique o console para mais detalhes.');
      }
    }
  });
});

async function verificarPreRequisitos(actor, className, level) {
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
}

async function cumprePreRequisitos(actor, caracteristica) {
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
