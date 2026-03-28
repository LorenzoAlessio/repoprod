(function () {
  'use strict';

  var resources = [
    {
      nome: 'Numero antiviolenza 1522',
      number: '1522',
      description: 'Attivo 24/7, gratuito, anonimo. Anche via chat su www.1522.eu',
      url: 'tel:1522',
      type: 'tutti'
    },
    {
      nome: 'D.i.Re \u2014 Donne in Rete contro la violenza',
      description: 'Rete nazionale dei centri antiviolenza. Cerca il centro pi\u00F9 vicino a te.',
      url: 'https://www.direcontrolaviolenza.it',
      type: 'tutti'
    },
    {
      nome: 'CAM \u2014 Centro Ascolto Uomini Maltrattanti',
      description: 'Supporto per uomini vittime o autori di violenza. Ascolto senza giudizio.',
      url: 'https://www.centrouominimaltrattanti.org',
      type: 'uomini'
    },
    {
      nome: 'Gay Help Line',
      number: '800 713 713',
      description: 'Supporto LGBTQ+ contro discriminazione e violenza nelle relazioni.',
      url: 'tel:800713713',
      type: 'lgbtq'
    },
    {
      nome: 'Telefono Azzurro',
      number: '19696',
      description: 'Per minori in difficolt\u00E0. Anche via chat su azzurro.it.',
      url: 'tel:19696',
      type: 'minori'
    }
  ];

  window.Resources = {
    getAll: function () {
      return resources;
    }
  };
})();
