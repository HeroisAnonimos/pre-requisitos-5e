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

  Hooks.on('preCreateActor', async (actor) => {
    if (game.settings.get('pre-requisitos-5e', 'enablePreRequisitos') && actor.type === 'character') {
      await verificarPreRequisitos(actor);
    }
  });

  Hooks.on('renderItemSheet5e', (app, html, data) => {
    const preRequisitos = app.document.getFlag('pre-requisitos-5e', 'preRequisitos') || '';
    const preRequisitosHtml = `
      <div class="form-group">
        <label>Pré-requisitos</label>
        <div class="drop-target" data-droppable="true" style="border: 1px dashed #888; padding: 5px; min-height: 50px;">
          <ul class="pre-requisitos-list">
            ${preRequisitos.split(',').map(req => `<li data-uuid="${req}">${req}</li>`).join('')}
          </ul>
          <button type="button" class="save-pre-requisitos">Salvar Pré-requisitos</button>
        </div>
      </div>
    `;
    html.find('.sheet-body').append(preRequisitosHtml);

    html.find('.drop-target').on('drop', async (event) => {
      event.preventDefault();
      const data = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
      console.log("Data do item arrastado:", data); // Log para verificar o conteúdo do item
      if (data?.type === 'Item' && data?.uuid) {
        const item = await fromUuid(data.uuid);
        if (item && (item.type === 'feat' || item.type === 'feature')) {
          const existingItems = html.find(`.pre-requisitos-list li[data-uuid="${item.uuid}"]`);
          if (existingItems.length === 0) {
            const listElement = `<li data-uuid="${item.uuid}">${item.name}</li>`;
            html.find('.pre-requisitos-list').append(listElement);
          } else {
            ui.notifications.warn('Esse item já está presente nos pré-requisitos.');
          }
        } else {
          ui.notifications.warn('O item arrastado não é uma característica ou aptidão válida.');
        }
      } else {
        ui.notifications.error('Erro ao processar o item arrastado.');
      }
    });

    html.find('.drop-target').on('dragover', (event) => {
      event.preventDefault();
    });

    html.find('.save-pre-requisitos').on('click', async () => {
      const preRequisitosList = html.find('.pre-requisitos-list li').map((i, el) => $(el).attr('data-uuid')).get();
      const preRequisitos = preRequisitosList.join(',');
      if (preRequisitos !== undefined) {
        try {
          await app.document.setFlag('pre-requisitos-5e', 'preRequisitos', preRequisitos);
          ui.notifications.info('Pré-requisitos salvos com sucesso.');
        } catch (error) {
          console.error('Erro ao salvar os pré-requisitos:', error);
          ui.notifications.error('Erro ao salvar os pré-requisitos. Verifique o console para mais detalhes.');
        }
      }
    });
  });

  Hooks.on('closeItemSheet5e', async (app, html) => {
    const preRequisitosList = html.find('.pre-requisitos-list li').map((i, el) => $(el).attr('data-uuid')).get();
    const preRequisitos = preRequisitosList.join(',');
    if (preRequisitos !== undefined) {
      try {
        await app.document.setFlag('pre-requisitos-5e', 'preRequisitos', preRequisitos);
      } catch (error) {
        console.error('Erro ao salvar os pré-requisitos:', error);
        ui.notifications.error('Erro ao salvar os pré-requisitos. Verifique o console para mais detalhes.');
      }
    }
  });

  // Adicionando um novo tipo de Avanço exclusivo para Esferas
  Hooks.on('renderItemSheet5e', (app, html, data) => {
    const advancementTypeOptions = html.find('select[name="type"]');
    if (advancementTypeOptions.length > 0) {
      advancementTypeOptions.append('<option value="grantSphere">Conceder Esfera</option>');
    }
  });

  Hooks.on('renderAdvancementSelection', (app, html, data) => {
    if (data.type === 'grantSphere') {
      const sphereHtml = `
        <div class="form-group">
          <label>Selecione a Esfera para Conceder:</label>
          <select name="sphereSelection" class="sphere-selection">
            <!-- Opções de esferas serão carregadas dinamicamente aqui -->
          </select>
        </div>
      `;
      html.find('.advancement-options').append(sphereHtml);
    }
  });
});

async function verificarPreRequisitos(actor) {
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
