/**
 * ═══════════════════════════════════════════════════════════════
 * app.js — PROFEF MUSIC AWARDS
 * 
 * Módulo principal da aplicação.
 * Contém: Storage, Router, Voting, Search, Theme, Lang,
 *         Admin, Particles, Animations, Statistics.
 * ═══════════════════════════════════════════════════════════════
 */

// Ordenar músicas por título (A-Z) — automático
if (typeof songs !== 'undefined') {
  songs.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
}

'use strict';

/* ═══════════════════════════════════════════════════════════════
   STORAGE MODULE — Abstração sobre localStorage
   Facilita migração futura para Firebase/Supabase/MySQL
   ═══════════════════════════════════════════════════════════════ */
const Storage = {
  prefix: 'profef_',

  /**
   * Obter valor do localStorage
   */
  get(key) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Storage.get error:', key, e);
      return null;
    }
  },

  /**
   * Guardar valor no localStorage
   */
  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage.set error:', key, e);
    }
  },

  /**
   * Remover valor do localStorage
   */
  remove(key) {
    localStorage.removeItem(this.prefix + key);
  },

  /**
   * Limpar todos os dados do projeto
   */
  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefix))
      .forEach(k => localStorage.removeItem(k));
  }
};


/* ═══════════════════════════════════════════════════════════════
   SONG MANAGER — CRUD com persistência LocalStorage
   ═══════════════════════════════════════════════════════════════ */
const SongManager = {
  getOverrides() {
    return Storage.get('song_overrides') || { added: [], edited: {}, deleted: [] };
  },

  saveOverrides(overrides) {
    Storage.set('song_overrides', overrides);
  },

  init() {
    const overrides = this.getOverrides();
    if (overrides.deleted.length === 0 && Object.keys(overrides.edited).length === 0 && overrides.added.length === 0) return;

    overrides.deleted.forEach(id => {
      const idx = songs.findIndex(s => s.id === id);
      if (idx !== -1) songs.splice(idx, 1);
    });

    Object.keys(overrides.edited).forEach(id => {
      const idx = songs.findIndex(s => s.id === parseInt(id));
      if (idx !== -1) {
        const edited = overrides.edited[id];
        if (edited.cover) edited.cover = this.fixCoverPath(edited.cover);
        songs[idx] = { ...songs[idx], ...edited };
      }
    });

    overrides.added.forEach(song => {
      if (song.cover) song.cover = this.fixCoverPath(song.cover);
      if (!songs.find(s => s.id === song.id)) {
        const editedData = overrides.edited[song.id];
        songs.push(editedData ? { ...song, ...editedData } : song);
      }
    });

    songs.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

    // Limpar overrides antigos com caminhos Windows
    let needsClean = false;
    overrides.added.forEach(s => { if (s.cover && s.cover.includes('\\')) needsClean = true; });
    Object.values(overrides.edited).forEach(s => { if (s.cover && s.cover.includes('\\')) needsClean = true; });
    if (needsClean) {
      overrides.added.forEach(s => { if (s.cover) s.cover = this.fixCoverPath(s.cover); });
      Object.values(overrides.edited).forEach(s => { if (s.cover) s.cover = this.fixCoverPath(s.cover); });
      this.saveOverrides(overrides);
    }
  },

  fixCoverPath(path) {
    if (!path) return path;
    path = path.replace(/['"]/g, '').trim();
    path = path.replace(/^.*[\\\/]assets[\\\/]covers[\\\/]/i, 'assets/covers/');
    path = path.replace(/^.*[\\\/]([^\\\/]+\.png)$/i, '$1');
    path = path.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_.]/g, '')
      .replace(/--+/g, '-');
    if (!path.startsWith('assets/covers/')) path = 'assets/covers/' + path;
    return path;
  },

  add(song) {
    const overrides = this.getOverrides();
    song.id = this.getNextId();
    if (song.cover) song.cover = this.fixCoverPath(song.cover);
    overrides.added.push(song);
    this.saveOverrides(overrides);
    songs.push(song);
    songs.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    return song.id;
  },

  edit(id, data) {
    const overrides = this.getOverrides();
    if (data.cover) data.cover = this.fixCoverPath(data.cover);
    overrides.edited[id] = data;
    this.saveOverrides(overrides);
    const idx = songs.findIndex(s => s.id === parseInt(id));
    if (idx !== -1) songs[idx] = { ...songs[idx], ...data };
  },

  remove(id) {
    const overrides = this.getOverrides();
    overrides.deleted.push(parseInt(id));
    this.saveOverrides(overrides);
    const idx = songs.findIndex(s => s.id === parseInt(id));
    if (idx !== -1) songs.splice(idx, 1);
  },

  getNextId() {
    let max = 0;
    songs.forEach(s => { if (s.id > max) max = s.id; });
    const overrides = this.getOverrides();
    overrides.added.forEach(s => { if (s.id > max) max = s.id; });
    return max + 1;
  },

  exportSongsJS() {
    let output = '\uFEFF/**\n * songs.js - Base de dados de musicas do PROFEF\n * \n * Este ficheiro contem todas as musicas originais.\n * NUNCA hardcode musicas no HTML. Tudo e gerado dinamicamente.\n */\n\nconst songs = [\n';

    songs.forEach(function(s, idx) {
      var props = [];
      props.push('id: ' + s.id);
      props.push('title: ' + JSON.stringify(s.title));
      props.push('artist: ' + JSON.stringify(s.artist));
      props.push('cover: ' + JSON.stringify(s.cover));
      props.push('audio: ' + JSON.stringify(s.audio));
      if (s.date) props.push('date: ' + JSON.stringify(s.date));
      props.push('style: ' + JSON.stringify(s.style));
      props.push('mood: ' + JSON.stringify(s.mood));
      if (s.description) props.push('description: ' + JSON.stringify(s.description));
      if (s.description_en) props.push('description_en: ' + JSON.stringify(s.description_en));
      if (s.description_es) props.push('description_es: ' + JSON.stringify(s.description_es));
      if (s.description_fr) props.push('description_fr: ' + JSON.stringify(s.description_fr));
      if (s.description_it) props.push('description_it: ' + JSON.stringify(s.description_it));
      if (s.lyrics) props.push('lyrics: ' + JSON.stringify(s.lyrics));
      if (s.lyrics_pt) props.push('lyrics_pt: ' + JSON.stringify(s.lyrics_pt));
      if (s.lyrics_lang) props.push('lyrics_lang: ' + JSON.stringify(s.lyrics_lang));
      if (s.youtube) props.push('youtube: ' + JSON.stringify(s.youtube));
      if (s.behind) props.push('behind: ' + JSON.stringify(s.behind));
      if (s.spotify !== undefined && s.spotify !== '') props.push('spotify: ' + JSON.stringify(s.spotify));

      output += '  { ' + props.join(', ') + ' }';
      if (idx < songs.length - 1) output += ',';
      output += '\n';
    });

    output += '];\n\n';
    output += 'function getSongById(id) {\n';
    output += '  return songs.find(song => song.id === id);\n';
    output += '}\n';

    return output;
  },

  exportJSON() {
    return JSON.stringify(songs, null, 2);
  },

  importJSON(json) {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) throw new Error('Not an array');
      const overrides = Storage.get('song_overrides') || { added: [], edited: {}, deleted: [] };
      data.forEach(song => {
        const idx = songs.findIndex(s => s.id === song.id);
        if (idx === -1) {
          songs.push(song);
          if (!overrides.added.find(a => a.id === song.id)) overrides.added.push(song);
        } else {
          songs[idx] = { ...songs[idx], ...song };
          overrides.edited[song.id] = { ...overrides.edited[song.id], ...song };
        }
      });
      songs.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
      this.saveOverrides(overrides);
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  }
};


/* ═══════════════════════════════════════════════════════════════
   INTERNATIONALIZATION (i18n)
   ═══════════════════════════════════════════════════════════════ */
const i18n = {
  pt: {
    hero_badge: 'EVERY SONG TELLS A STORY',
    hero_subtitle: 'MÚSICA CRIADA COM IA · LETRAS ORIGINAIS',
    hero_songs: 'Músicas',
    hero_stories: 'Histórias',
    hero_vision: 'Visão',
    hero_cta: 'Explorar Músicas →',
    nav_home: 'Home',
    nav_songs: 'Músicas',
    nav_about: 'Sobre',
    nav_ranking: 'Ranking',
    nav_styles: 'Estilos',
    nav_requests: 'Pedidos',
    nav_statistics: 'Estatísticas',
    about_badge: 'SOBRE O PROJETO',
    about_title: 'Criatividade Humana + IA',
    about_preview_1: 'PROFEF é um projeto musical que une criatividade humana e Inteligência Artificial para dar vida a canções originais. Cada música começa muito antes da melodia — tudo nasce de uma ideia, de uma emoção, de uma memória, de uma viagem ou de um lugar especial.',
    about_preview_2: 'As letras são totalmente originais, escritas para contar histórias e criar ligações com quem ouve. A produção musical recorre ao potencial da IA como ferramenta criativa, sem nunca abdicar da originalidade.',
    about_more: 'Saber Mais →',
    songs_badge: 'CATÁLOGO',
    songs_title: 'Todas as Músicas',
    songs_desc: 'Músicas originais. Cada uma conta uma história diferente.',
    songs_all: 'Todas',
    featured_title: 'Últimos Lançamentos',
    featured_desc: 'Explora o catálogo completo de músicas originais.',
    featured_all: 'Ver Todas as Músicas →',
    ranking_badge: 'RANKING',
    ranking_title: 'Votação + Ranking',
    ranking_desc: 'Escolhe as tuas 3 músicas favoritas de todas. O ranking é atualizado em tempo real.',
    contest_title: 'Como Funciona o Concurso',
    contest_step1: 'Escolhe até 3 músicas de todo o catálogo que mais te emocionam.',
    contest_step2: 'Posiciona-as por ordem de preferência: 1ª, 2ª e 3ª escolha.',
    contest_step3: 'Submete o teu voto e vê o ranking atualizado em tempo real!',
    contest_note: 'Apenas subscritores podem votar. Cada utilizador pode votar apenas uma vez.',
    songs_lowercase: 'músicas',
    vote_first: '1ª Escolha',
    vote_second: '2ª Escolha',
    vote_third: '3ª Escolha',
    vote_selected: 'Selecionaste',
    vote_submit: 'Submeter Voto',
    modal_thanks: 'Obrigado por votares!',
    modal_message: 'Os teus votos foram registados com sucesso!',
    search_placeholder: 'Pesquisar músicas...',
    search_empty: 'Nenhum resultado encontrado.',
    back: '← Voltar',
    count_days: 'Dias',
    count_hours: 'Horas',
    count_mins: 'Min',
    count_secs: 'Seg',
    recent_badge: 'VISTOS RECENTEMENTE',
    recent_title: 'Ouviste Recentemente',
    about_pt_1: 'PROFEF é um projeto musical que une criatividade humana e Inteligência Artificial para dar vida a canções originais.',
    about_pt_2: 'Cada música começa muito antes da melodia. Tudo nasce de uma ideia, de uma emoção, de uma memória, de uma viagem ou de um lugar especial. A partir daí, são escritas letras 100% originais, criadas para contar histórias, transmitir emoções e criar uma ligação genuína com quem as ouve.',
    about_pt_3: 'A produção musical é desenvolvida com o apoio da Inteligência Artificial, utilizada como uma ferramenta criativa para transformar essas histórias em música. A IA não substitui a criatividade humana; é um instrumento que permite explorar novos estilos, sonoridades e possibilidades musicais.',
    about_pt_4: 'O projeto percorre diversos géneros, como folk, pop, country, rock alternativo, música latina, Soul / Blues e baladas cinematográficas, mantendo sempre a mesma identidade: cada música conta uma história.',
    about_pt_5: 'Mais do que criar canções, o PROFEF pretende proporcionar experiências, levando o ouvinte a viajar por lugares reais e imaginários, reviver memórias e descobrir novas emoções através da música.',
    about_pt_6: 'Este é um projeto que demonstra como a criatividade humana e a tecnologia podem trabalhar em conjunto para criar algo verdadeiramente único.',
    about_pt_quote: '"Todas as grandes histórias merecem uma banda sonora." 🎵',
    artist_badge: 'O ARTISTA',
    artist_pt_1: 'A música sempre foi mais do que uma paixão para o PROFEF — é uma forma de contar histórias, despertar emoções e transformar memórias em canções.',
    artist_pt_2: 'Cada música nasce de uma ideia, de um lugar, de uma viagem ou de um momento marcante. Dos fiordes da Islândia às ruas de Itália, das aventuras de Interrail aos campos infinitos cobertos de flores, cada composição convida o ouvinte a embarcar numa viagem única, onde a imaginação e a realidade se cruzam.',
    artist_pt_3: 'As letras são totalmente originais, escritas para transmitir emoções, contar histórias e criar ligações com quem as ouve. A produção musical recorre ao potencial da Inteligência Artificial como ferramenta criativa, explorando novas sonoridades e possibilidades musicais, sem nunca abdicar da originalidade das ideias e das narrativas.',
    artist_pt_4: 'Sem se prender a um único género musical, o PROFEF explora sonoridades que vão do folk ao pop, do country ao rock alternativo, passando por Soul / Blues, baladas cinematográficas e melodias inspiradoras. O elemento comum é sempre o mesmo: histórias que merecem ser ouvidas.',
    artist_pt_5: 'Cada lançamento procura criar uma experiência diferente, com letras originais, capas cuidadosamente concebidas e uma identidade própria que valoriza a emoção acima de tudo.',
    artist_pt_6: 'PROFEF acredita que a tecnologia pode ser uma aliada da criatividade. Quando a imaginação humana e a Inteligência Artificial trabalham em conjunto, é possível dar vida a músicas únicas que inspiram, emocionam e ficam na memória.',
    artist_pt_7: 'Porque, para PROFEF, uma boa música não é apenas aquela que se ouve... é aquela que fica connosco muito depois de terminar.',
    gallery_badge: 'GALERIA',
    gallery_title: 'Capas dos Álbuns',
    ranking_badge: 'RANKING',
    ranking_title: 'Ranking',
    ranking_desc: 'As músicas mais votadas pela comunidade.',
    stats_badge: 'ESTATÍSTICAS',
    stats_title: 'Estatísticas',
    stats_desc: 'Dados gerais de todas as músicas e votos.',
    admin_title: 'Painel Administrativo',
    admin_login_title: 'Acesso Admin',
    admin_login_text: 'Introduz a palavra-passe para aceder ao painel.',
    admin_password: 'Palavra-passe',
    admin_login_btn: 'Entrar',
    admin_login_error: 'Palavra-passe incorreta.',
    admin_export_csv: 'Export CSV',
    admin_export_json: 'Export JSON',
    admin_reset: 'Reset Votos',
    admin_logout: 'Sair',
    admin_total_votes: 'Total de Votos',
    admin_total_songs: 'Músicas',
    admin_groups: 'Géneros',
    admin_voting: 'Votação',
    admin_ranking: 'Ranking Geral',
    admin_song: 'Música',
    admin_group: 'Grupo',
    admin_votes: 'Votos',
    admin_manage_songs: 'Gerir Músicas',
    admin_add_song: 'Adicionar Música',
    admin_edit_song: 'Editar Música',
    admin_delete_song: 'Eliminar Música',
    admin_save_song: 'Guardar',
    admin_cancel: 'Cancelar',
    admin_confirm_delete: 'Tem a certeza que quer eliminar esta música?',
    admin_export_songs_js: 'Exportar songs.js',
    admin_import_json: 'Importar JSON',
    admin_no_songs: 'Nenhuma música encontrada.',
    admin_song_added: 'Música adicionada com sucesso!',
    admin_song_edited: 'Música editada com sucesso!',
    admin_song_deleted: 'Música eliminada com sucesso!',
    admin_field_title: 'Título',
    admin_field_artist: 'Artista',
    admin_field_group: 'Ano',
    admin_field_date: 'Data de Lançamento',
    admin_field_style: 'Estilo',
    admin_field_mood: 'Mood',
    admin_field_cover: 'Capa (caminho)',
    admin_field_audio: 'Áudio (caminho)',
    admin_field_youtube: 'YouTube',
    admin_field_description: 'Descrição (PT)',
    admin_field_description_en: 'Descrição (EN)',
    admin_field_description_es: 'Descrição (ES)',
    admin_field_description_fr: 'Descrição (FR)',
    admin_field_description_it: 'Descrição (IT)',
    admin_field_lyrics: 'Letra (Inglês)',
    admin_field_lyrics_pt: 'Letra (Português)',
    admin_field_lyrics_lang: 'Idioma da Letra',
    voting_open: 'Votação Aberta',
    voting_closed: 'Votação Encerrada',
    share: 'Partilhar',
    favorite: 'Favoritar',
    unfavorite: 'Remover Favorito',
    stats_total_votes: 'Total de Votos',
    stats_avg_per_song: 'Média por Música',
    stats_most_voted: 'Mais Votada',
    tooltip_listen: 'Ouvir',
    tooltip_youtube_preview: 'Pré-visualizar no YouTube',
    tooltip_click_to_vote: 'Clicar para votar',
    tooltip_view_details: 'Ver detalhes',
    tooltip_click_to_zoom: 'Clicar para ampliar',
    tooltip_enter_group: 'Entrar no Grupo',
    group_label: 'Grupo',
    top_songs: 'Top Músicas',
    no_data: 'Sem dados',
    songs_label: 'músicas',
    lyrics_label: 'LETRAS',
    lang_english: 'INGLÊS',
    lang_portuguese: 'PORTUGUÊS',
    lang_spanish: 'ESPANHOL',
    lang_french: 'FRANCÊS',
    lang_italian: 'ITALIANO',
    behind_the_song: 'POR TRÁS DA MÚSICA',
    behind_the_song_en: 'BEHIND THE SONG',
    already_voted_group: 'Já votaste no ranking!',
    your_votes: 'Os teus votos:',
    hof_no_votes: 'Ainda não há votos. Sé o primeiro a votar!',
    song_of_the_day: 'MÚSICA DO DIA',
    tooltip_back: 'Voltar',
    tooltip_open_youtube: 'Abrir no YouTube',
    tooltip_view_youtube_channel: 'Ver canal no YouTube',
    tooltip_share_song: 'Partilhar música',
    tooltip_add_favorites: 'Adicionar aos favoritos',
    tooltip_view: 'Ver',
    tooltip_open: 'Abrir',
    tooltip_close: 'Fechar',
    cover_enlarged: 'Capa ampliada',
    voting_closed_alert: 'A votação está fechada.',
    already_voted_phase: 'Já votaste no ranking!',
    link_copied: 'Link copiado!',
    share_text_pt: 'Ouve',
    share_text_pt2: 'no PROFEF...',
    admin_confirm_reset: 'Tem a certeza que quer apagar todos os votos?',
    tooltip_enter_password: 'Introduzir palavra-passe',
    tooltip_enter_admin: 'Entrar no painel administrativo',
    tooltip_back_home: 'Voltar à página principal',
    tooltip_export_csv: 'Exportar dados para CSV',
    tooltip_export_json: 'Exportar dados para JSON',
    tooltip_reset_votes: 'Apagar todos os votos',
    tooltip_admin_logout: 'Sair do painel admin',
    tooltip_close_voting: 'Fechar votação',
    tooltip_open_voting: 'Abrir votação',
    group_badge_label: 'GRUPO',
    requests_badge: 'PEDIDOS',
    requests_title: 'Pede uma Música',
    requests_desc: 'Tem uma ideia para uma música? Partilha connosco o teu tema e nós criamos uma canção especialmente para ti.',
    req_name_label: 'O teu nome',
    req_title_label: 'Título da música',
    req_theme_label: 'Tema / Ideia da letra',
    req_style_label: 'Estilo musical',
    req_mood_label: 'Emoção / Mood',
    req_email_label: 'Email (opcional)',
    req_submit: 'Enviar Pedido',
    req_success_title: 'Pedido enviado!',
    req_success_text: 'Obrigado! O teu pedido foi registado. Quando a música estiver pronta, ela aparecerá numa secção separada do catálogo.',
    req_another: 'Enviar outro pedido',
    req_completed_badge: 'CRIADOS',
    req_completed_title: 'Músicas Criadas a partir de Pedidos',
    req_pedido_de: 'Pedido de',
    req_status_pending: 'Pendente',
    req_status_approved: 'Aprovado',
    req_status_rejected: 'Rejeitado',
    req_status_completed: 'Criada',
    admin_requests: 'Pedidos de Músicas',
    quotes_badge: 'CITAÇÕES',
    quotes_title: 'Palavras que Inspiram',
    sub_login_title: 'Entrar',
    sub_login_text: 'Entra para teres acesso a funcionalidades exclusivas.',
    sub_register_title: 'Tornar-te Subscritor',
    sub_register_text: 'Regista-te para votares, pedires músicas e guardares favoritos.',
    sub_email_label: 'Email',
    sub_password_label: 'Palavra-passe',
    sub_name_label: 'Nome',
    sub_login_btn: 'Entrar',
    sub_register_btn: 'Registar',
    sub_logout_btn: 'Sair da conta',
    sub_no_account: 'Ainda não tens conta?',
    sub_register_link: 'Registar',
    sub_has_account: 'Já tens conta?',
    sub_login_link: 'Entrar',
    sub_login_tooltip: 'Entrar / Registar',
    sub_my_profile: 'O meu perfil',
    sub_enter: 'Entrar',
    sub_error_fields: 'Preenche todos os campos.',
    sub_error_password: 'A palavra-passe deve ter pelo menos 6 caracteres.',
    sub_error_exists: 'Já existe uma conta com este email.',
    sub_error_invalid: 'Email ou palavra-passe incorretos.',
    sub_stat_favorites: 'Favoritos',
    sub_stat_requests: 'Pedidos',
    sub_stat_votes: 'Votos',
    sub_joined: 'Registado',
    admin_subscribers: 'Subscritores',
    sub_required_title: 'Subscritor necessário',
    sub_required_text: 'Esta funcionalidade é exclusiva para subscritores. Regista-te gratuitamente para teres acesso.',
    sub_required_btn: 'Tornar-te Subscritor',
    styles_badge: 'ESTILOS',
    styles_title: 'Músicas por Género',
    styles_desc: 'Explora o catálogo por estilo musical. Cada género conta uma história diferente.',
    styles_songs: 'músicas',
    styles_no_songs: 'Ainda não há músicas neste estilo.',
    comments_badge: 'COMENTÁRIOS',
    comments_title: 'O que achas desta música?',
    comments_rules_title: 'Regras da Comunidade',
    comments_rule1: 'Sê respeitoso. Todos os gostos são válidos.',
    comments_rule2: 'Sem spam, publicidade ou conteúdo ofensivo.',
    comments_rule3: 'Comentários adequados. Violência e conteúdo impróprio serão eliminados.',
    comments_rule4: 'Apenas subscritores podem comentar.',
    comments_placeholder: 'Escreve o teu comentário...',
    comments_submit: 'Enviar',
    comments_login_to_comment: 'Entra para poderes comentar.',
    comments_empty: 'Ainda não há comentários. Sé o primeiro!',
    comments_delete: 'Eliminar',
    comments_confirm_delete: 'Eliminar este comentário?',
    privacy_title: 'Política de Privacidade',
    privacy_last_updated: 'Última atualização: Julho 2026',
    privacy_p1_title: '1. Informações que recolhemos',
    privacy_p1_text: 'Recolhemos apenas as informações que forneces diretamente: email (ao registares-te, subscreveres a newsletter ou enviarem pedidos de música), nome (ao criares conta), endereço IP (para controlo de votos), e dados de navegação (páginas visitadas, tempo de permanência).',
    privacy_p2_title: '2. Como utilizamos os teus dados',
    privacy_p2_text: 'Utilizamos os teus dados exclusivamente para: gerir a tua conta de subscritor, processar votos e pedidos de música, enviar newsletters (se subscrito), melhorar a experiência de navegação e garantir a segurança do site.',
    privacy_p3_title: '3. Partilha de dados',
    privacy_p3_text: 'Não vendemos, partilhamos ou distribuímos os teus dados pessoais com terceiros. Os dados são armazenados localmente no teu navegador (localStorage) e não são transmitidos a servidores externos.',
    privacy_p4_title: '4. Cookies',
    privacy_p4_text: 'O site utiliza cookies essenciais para o funcionamento (preferências de tema, idioma, estado de login). Não utilizamos cookies de rastreamento de terceiros.',
    privacy_p5_title: '5. Os teus direitos',
    privacy_p5_text: 'Tens direito a: aceder aos teus dados, alterar o teu perfil, eliminar a tua conta a qualquer momento, e recusar cookies. Para exercer estes direitos, utiliza as opções disponíveis no teu perfil de subscritor.',
    privacy_p6_title: '6. Segurança',
    privacy_p6_text: 'Utilizamos hashing SHA-256 para proteger as palavras-passe. No entanto, nenhum sistema é 100% seguro. Recomendamos a utilização de palavras-passe fortes e únicas.',
    privacy_p7_title: '7. Contacto',
    privacy_p7_text: 'Para questões sobre privacidade, contacta-nos através do Facebook ou YouTube.',
    error_404_title: 'Página não encontrada',
    error_404_desc: 'O que procuras não existe. Talvez tenha mudado de endereço.',
    error_404_home: 'Voltar ao Início',
    sub_edit_btn: '✏️ Editar',
    sub_edit_title: 'Editar Perfil',
    sub_edit_new_password: 'Nova palavra-passe (deixa vazio para manter)',
    sub_edit_save: 'Guardar Alterações',
    sub_edit_delete_account: '⚠️ Eliminar Conta',
    sub_edit_cancel: '← Voltar',
    sub_edit_error_fields: 'Preenche todos os campos.',
    sub_edit_error_password: 'A palavra-passe deve ter pelo menos 6 caracteres.',
    sub_edit_error_current_password: 'Palavra-passe atual incorreta.',
    sub_edit_success: 'Perfil atualizado com sucesso!',
    sub_edit_confirm_delete: 'Tem a certeza que queres eliminar a tua conta? Esta ação é irreversível e perderes todos os teus dados (favoritos, votos, pedidos).',
    cookie_text: 'Este site utiliza cookies para melhorar a experiência. Ao continuares, concordas com a nossa Política de Privacidade.',
    cookie_accept: 'Aceitar',
    cookie_decline: 'Recusar',
    footer_privacy: 'Política de Privacidade'
  },
  en: {
    hero_badge: 'EVERY SONG TELLS A STORY',
    hero_subtitle: 'AI-CREATED MUSIC · ORIGINAL LYRICS',
    hero_songs: 'Songs',
    hero_stories: 'Stories',
    hero_vision: 'Vision',
    hero_cta: 'Explore Songs →',
    nav_home: 'Home',
    nav_songs: 'Songs',
    nav_about: 'About',
    nav_ranking: 'Ranking',
    nav_styles: 'Styles',
    nav_requests: 'Requests',
    nav_statistics: 'Statistics',
    about_badge: 'ABOUT THE PROJECT',
    about_title: 'Human Creativity + AI',
    about_preview_1: 'PROFEF is a musical project that combines human creativity and Artificial Intelligence to bring original songs to life. Every song starts long before the melody — it all begins with an idea, an emotion, a memory, a trip, or a special place.',
    about_preview_2: 'The lyrics are 100% original, written to tell stories and create connections with listeners. Music production uses AI as a creative tool, never compromising originality.',
    about_more: 'Learn More →',
    songs_badge: 'CATALOG',
    songs_title: 'All Songs',
    songs_desc: 'Original songs. Each one tells a different story.',
    songs_all: 'All',
    featured_title: 'Latest Releases',
    featured_desc: 'Explore the full catalog of original songs.',
    featured_all: 'View All Songs →',
    ranking_badge: 'RANKING',
    ranking_title: 'Voting + Ranking',
    ranking_desc: 'Choose your 3 favorite songs from all. The ranking updates in real time.',
    contest_title: 'How the Contest Works',
    contest_step1: 'Choose up to 3 songs from the entire catalog that move you the most.',
    contest_step2: 'Rank them in order of preference: 1st, 2nd, and 3rd choice.',
    contest_step3: 'Submit your vote and see the ranking update in real time!',
    contest_note: 'Only subscribers can vote. Each user may vote only once.',
    songs_lowercase: 'songs',
    vote_first: '1st Choice',
    vote_second: '2nd Choice',
    vote_third: '3rd Choice',
    vote_selected: 'You selected',
    vote_submit: 'Submit Vote',
    modal_thanks: 'Thank you for voting!',
    modal_message: 'Your votes have been recorded successfully!',
    search_placeholder: 'Search songs...',
    search_empty: 'No results found.',
    back: '← Back',
    count_days: 'Days',
    count_hours: 'Hours',
    count_mins: 'Min',
    count_secs: 'Sec',
    recent_badge: 'RECENTLY VIEWED',
    recent_title: 'You Recently Listened',
    about_pt_1: 'PROFEF is a musical project that combines human creativity and Artificial Intelligence to bring original songs to life.',
    about_pt_2: 'Every song starts long before the melody. It all begins with an idea, an emotion, a memory, a trip, or a special place. From there, 100% original lyrics are written, created to tell stories, convey emotions, and build a genuine connection with listeners.',
    about_pt_3: 'Music production is developed with the support of Artificial Intelligence, used as a creative tool to transform these stories into music. AI does not replace human creativity; it is an instrument that allows exploring new styles, sounds, and musical possibilities.',
    about_pt_4: 'The project spans various genres, such as folk, pop, country, alternative rock, Latin music, Soul/Blues, and cinematic ballads, always maintaining the same identity: every song tells a story.',
    about_pt_5: 'More than creating songs, PROFEF aims to provide experiences, taking the listener on a journey through real and imaginary places, reliving memories, and discovering new emotions through music.',
    about_pt_6: 'This is a project that demonstrates how human creativity and technology can work together to create something truly unique.',
    about_pt_quote: '"Every great story deserves a soundtrack." 🎵',
    artist_badge: 'THE ARTIST',
    artist_pt_1: 'Music has always been more than a passion for PROFEF — it is a way to tell stories, awaken emotions, and turn memories into songs.',
    artist_pt_2: 'Every song is born from an idea, a place, a trip, or a memorable moment. From the fjords of Iceland to the streets of Italy, from Interrail adventures to endless fields covered in flowers, each composition invites the listener on a unique journey where imagination and reality intertwine.',
    artist_pt_3: 'The lyrics are entirely original, written to convey emotions, tell stories, and connect with listeners. Music production leverages the potential of Artificial Intelligence as a creative tool, exploring new sounds and musical possibilities without ever compromising the originality of ideas and narratives.',
    artist_pt_4: 'Without being tied to a single musical genre, PROFEF explores sounds ranging from folk to pop, from country to alternative rock, including Soul/Blues, cinematic ballads, and inspiring melodies. The common thread is always the same: stories worth hearing.',
    artist_pt_5: 'Each release seeks to create a different experience, with original lyrics, carefully designed artwork, and a unique identity that values emotion above all else.',
    artist_pt_6: 'PROFEF believes that technology can be an ally of creativity. When human imagination and Artificial Intelligence work together, it is possible to bring to life unique songs that inspire, move, and stay in memory.',
    artist_pt_7: 'Because, for PROFEF, a good song is not just one you hear... it is one that stays with you long after it ends.',
    gallery_badge: 'GALLERY',
    gallery_title: 'Album Covers',
    ranking_badge: 'RANKING',
    ranking_title: 'Ranking',
    ranking_desc: 'The most voted songs by the community.',
    stats_badge: 'STATISTICS',
    stats_title: 'Statistics',
    stats_desc: 'General data from all songs and votes.',
    admin_title: 'Admin Dashboard',
    admin_login_title: 'Admin Access',
    admin_login_text: 'Enter the password to access the dashboard.',
    admin_password: 'Password',
    admin_login_btn: 'Login',
    admin_login_error: 'Incorrect password.',
    admin_export_csv: 'Export CSV',
    admin_export_json: 'Export JSON',
    admin_reset: 'Reset Votes',
    admin_logout: 'Logout',
    admin_total_votes: 'Total Votes',
    admin_total_songs: 'Songs',
    admin_groups: 'Genres',
    admin_voting: 'Voting',
    admin_ranking: 'General Ranking',
    admin_song: 'Song',
    admin_group: 'Group',
    admin_votes: 'Votes',
    admin_manage_songs: 'Manage Songs',
    admin_add_song: 'Add Song',
    admin_edit_song: 'Edit Song',
    admin_delete_song: 'Delete Song',
    admin_save_song: 'Save',
    admin_cancel: 'Cancel',
    admin_confirm_delete: 'Are you sure you want to delete this song?',
    admin_export_songs_js: 'Export songs.js',
    admin_import_json: 'Import JSON',
    admin_no_songs: 'No songs found.',
    admin_song_added: 'Song added successfully!',
    admin_song_edited: 'Song edited successfully!',
    admin_song_deleted: 'Song deleted successfully!',
    admin_field_title: 'Title',
    admin_field_artist: 'Artist',
    admin_field_group: 'Year',
    admin_field_date: 'Release Date',
    admin_field_style: 'Style',
    admin_field_mood: 'Mood',
    admin_field_cover: 'Cover (path)',
    admin_field_audio: 'Audio (path)',
    admin_field_youtube: 'YouTube',
    admin_field_description: 'Description (PT)',
    admin_field_description_en: 'Description (EN)',
    admin_field_description_es: 'Description (ES)',
    admin_field_description_fr: 'Description (FR)',
    admin_field_description_it: 'Description (IT)',
    admin_field_lyrics: 'Lyrics (English)',
    admin_field_lyrics_pt: 'Lyrics (Portuguese)',
    admin_field_lyrics_lang: 'Lyrics Language',
    voting_open: 'Voting Open',
    voting_closed: 'Voting Closed',
    share: 'Share',
    favorite: 'Favorite',
    unfavorite: 'Remove Favorite',
    stats_total_votes: 'Total Votes',
    stats_avg_per_song: 'Average per Song',
    stats_most_voted: 'Most Voted',
    tooltip_listen: 'Listen to',
    tooltip_youtube_preview: 'Preview on YouTube',
    tooltip_click_to_vote: 'Click to vote',
    tooltip_view_details: 'View details',
    tooltip_click_to_zoom: 'Click to zoom',
    tooltip_enter_group: 'Enter Group',
    group_label: 'Group',
    top_songs: 'Top Songs',
    no_data: 'No data',
    songs_label: 'songs',
    lyrics_label: 'LYRICS',
    lang_english: 'ENGLISH',
    lang_portuguese: 'PORTUGUESE',
    lang_spanish: 'SPANISH',
    lang_french: 'FRENCH',
    lang_italian: 'ITALIAN',
    behind_the_song: 'BEHIND THE SONG',
    behind_the_song_en: 'BEHIND THE SONG',
    already_voted_group: 'You already voted in the ranking!',
    your_votes: 'Your votes:',
    hof_no_votes: 'No votes yet. Be the first to vote!',
    song_of_the_day: 'SONG OF THE DAY',
    tooltip_back: 'Back',
    tooltip_open_youtube: 'Open on YouTube',
    tooltip_view_youtube_channel: 'View YouTube channel',
    tooltip_share_song: 'Share song',
    tooltip_add_favorites: 'Add to favorites',
    tooltip_view: 'View',
    tooltip_open: 'Open',
    tooltip_close: 'Close',
    cover_enlarged: 'Enlarged cover',
    voting_closed_alert: 'Voting is closed.',
    already_voted_phase: 'You already voted in the ranking!',
    link_copied: 'Link copied!',
    share_text_pt: 'Listen to',
    share_text_pt2: 'on PROFEF...',
    admin_confirm_reset: 'Are you sure you want to delete all votes?',
    tooltip_enter_password: 'Enter password',
    tooltip_enter_admin: 'Enter admin dashboard',
    tooltip_back_home: 'Back to homepage',
    tooltip_export_csv: 'Export data to CSV',
    tooltip_export_json: 'Export data to JSON',
    tooltip_reset_votes: 'Delete all votes',
    tooltip_admin_logout: 'Logout admin panel',
    tooltip_close_voting: 'Close voting',
    tooltip_open_voting: 'Open voting',
    group_badge_label: 'GROUP',
    requests_badge: 'REQUESTS',
    requests_title: 'Request a Song',
    requests_desc: 'Have an idea for a song? Share your theme with us and we\'ll create a song especially for you.',
    req_name_label: 'Your name',
    req_title_label: 'Song title',
    req_theme_label: 'Theme / Lyric idea',
    req_style_label: 'Musical style',
    req_mood_label: 'Emotion / Mood',
    req_email_label: 'Email (optional)',
    req_submit: 'Submit Request',
    req_success_title: 'Request submitted!',
    req_success_text: 'Thank you! Your request has been recorded. When the song is created, it will appear in a separate section of the catalog.',
    req_another: 'Submit another request',
    req_completed_badge: 'CREATED',
    req_completed_title: 'Songs Created from Requests',
    req_pedido_de: 'Request by',
    req_status_pending: 'Pending',
    req_status_approved: 'Approved',
    req_status_rejected: 'Rejected',
    req_status_completed: 'Created',
    admin_requests: 'Song Requests',
    quotes_badge: 'QUOTES',
    quotes_title: 'Words that Inspire',
    sub_login_title: 'Log In',
    sub_login_text: 'Log in to access exclusive features.',
    sub_register_title: 'Become a Subscriber',
    sub_register_text: 'Sign up to vote, request songs, and save favorites.',
    sub_email_label: 'Email',
    sub_password_label: 'Password',
    sub_name_label: 'Name',
    sub_login_btn: 'Log In',
    sub_register_btn: 'Sign Up',
    sub_logout_btn: 'Log Out',
    sub_no_account: "Don't have an account?",
    sub_register_link: 'Sign Up',
    sub_has_account: 'Already have an account?',
    sub_login_link: 'Log In',
    sub_login_tooltip: 'Log In / Sign Up',
    sub_my_profile: 'My Profile',
    sub_enter: 'Log In',
    sub_error_fields: 'Please fill in all fields.',
    sub_error_password: 'Password must be at least 6 characters.',
    sub_error_exists: 'An account with this email already exists.',
    sub_error_invalid: 'Invalid email or password.',
    sub_stat_favorites: 'Favorites',
    sub_stat_requests: 'Requests',
    sub_stat_votes: 'Votes',
    sub_joined: 'Joined',
    admin_subscribers: 'Subscribers',
    sub_required_title: 'Subscriber required',
    sub_required_text: 'This feature is exclusive to subscribers. Sign up for free to get access.',
    sub_required_btn: 'Become a Subscriber',
    styles_badge: 'STYLES',
    styles_title: 'Songs by Genre',
    styles_desc: 'Explore the catalog by musical style. Each genre tells a different story.',
    styles_songs: 'songs',
    styles_no_songs: 'No songs in this style yet.',
    comments_badge: 'COMMENTS',
    comments_title: 'What do you think of this song?',
    comments_rules_title: 'Community Rules',
    comments_rule1: 'Be respectful. All tastes are valid.',
    comments_rule2: 'No spam, advertising, or offensive content.',
    comments_rule3: 'Keep comments appropriate. Violence and inappropriate content will be removed.',
    comments_rule4: 'Only subscribers can comment.',
    comments_placeholder: 'Write your comment...',
    comments_submit: 'Submit',
    comments_login_to_comment: 'Log in to leave a comment.',
    comments_empty: 'No comments yet. Be the first!',
    comments_delete: 'Delete',
    comments_confirm_delete: 'Delete this comment?',
    privacy_title: 'Privacy Policy',
    privacy_last_updated: 'Last updated: July 2026',
    privacy_p1_title: '1. Information We Collect',
    privacy_p1_text: 'We only collect information you provide directly: email (when subscribing, signing up for the newsletter, or submitting song requests), name (when creating an account), IP address (for vote control), and browsing data (pages visited, time spent).',
    privacy_p2_title: '2. How We Use Your Data',
    privacy_p2_text: 'We use your data exclusively to: manage your subscriber account, process votes and song requests, send newsletters (if subscribed), improve the browsing experience, and ensure site security.',
    privacy_p3_title: '3. Data Sharing',
    privacy_p3_text: 'We do not sell, share, or distribute your personal data with third parties. Data is stored locally in your browser (localStorage) and is not transmitted to external servers.',
    privacy_p4_title: '4. Cookies',
    privacy_p4_text: 'The site uses essential cookies for functionality (theme preferences, language, login state). We do not use third-party tracking cookies.',
    privacy_p5_title: '5. Your Rights',
    privacy_p5_text: 'You have the right to: access your data, edit your profile, delete your account at any time, and refuse cookies. To exercise these rights, use the options available in your subscriber profile.',
    privacy_p6_title: '6. Security',
    privacy_p6_text: 'We use SHA-256 hashing to protect passwords. However, no system is 100% secure. We recommend using strong, unique passwords.',
    privacy_p7_title: '7. Contact',
    privacy_p7_text: 'For privacy questions, contact us via Facebook or YouTube.',
    error_404_title: 'Page not found',
    error_404_desc: 'The page you\'re looking for doesn\'t exist. It may have moved.',
    error_404_home: 'Back to Home',
    sub_edit_btn: '✏️ Edit',
    sub_edit_title: 'Edit Profile',
    sub_edit_new_password: 'New password (leave empty to keep)',
    sub_edit_save: 'Save Changes',
    sub_edit_delete_account: '⚠️ Delete Account',
    sub_edit_cancel: '← Back',
    sub_edit_error_fields: 'Please fill in all fields.',
    sub_edit_error_password: 'Password must be at least 6 characters.',
    sub_edit_error_current_password: 'Current password is incorrect.',
    sub_edit_success: 'Profile updated successfully!',
    sub_edit_confirm_delete: 'Are you sure you want to delete your account? This action is irreversible and you will lose all your data (favorites, votes, requests).',
    cookie_text: 'This site uses cookies to improve your experience. By continuing, you agree to our Privacy Policy.',
    cookie_accept: 'Accept',
    cookie_decline: 'Decline',
    footer_privacy: 'Privacy Policy'
  },
  es: {
    hero_badge: 'CADA CANCIÓN CUENTA UNA HISTORIA',
    hero_subtitle: 'MÚSICA CREADA CON IA · LETRAS ORIGINALES',
    hero_songs: 'Canciones',
    hero_stories: 'Historias',
    hero_vision: 'Visión',
    hero_cta: 'Explorar Canciones →',
    nav_home: 'Inicio',
    nav_songs: 'Canciones',
    nav_about: 'Sobre',
    nav_ranking: 'Clasificación',
    nav_styles: 'Estilos',
    nav_requests: 'Solicitudes',
    nav_statistics: 'Estadísticas',
    about_badge: 'SOBRE EL PROYECTO',
    about_title: 'Creatividad Humana + IA',
    about_preview_1: 'PROFEF es un proyecto musical que combina la creatividad humana y la Inteligencia Artificial para dar vida a canciones originales. Cada canción empieza mucho antes de la melodía: todo comienza con una idea, una emoción, un recuerdo, un viaje o un lugar especial.',
    about_preview_2: 'Las letras son 100% originales, escritas para contar historias y crear conexiones con los oyentes. La producción musical utiliza la IA como herramienta creativa, sin comprometer nunca la originalidad.',
    about_more: 'Saber Más →',
    songs_badge: 'CATÁLOGO',
    songs_title: 'Todas las Canciones',
    songs_desc: 'Canciones originales. Cada una cuenta una historia diferente.',
    songs_all: 'Todas',
    featured_title: 'Últimos Lanzamientos',
    featured_desc: 'Explora el catálogo completo de canciones originales.',
    featured_all: 'Ver Todas las Canciones →',
    ranking_badge: 'CLASIFICACIÓN',
    ranking_title: 'Votación + Clasificación',
    ranking_desc: 'Elige tus 3 canciones favoritas de entre todas. La clasificación se actualiza en tiempo real.',
    contest_title: 'Cómo Funciona el Concurso',
    contest_step1: 'Elige hasta 3 canciones de todo el catálogo que más te emocionen.',
    contest_step2: 'Ordénalas por preferencia: 1ª, 2ª y 3ª opción.',
    contest_step3: 'Envía tu voto y ve cómo la clasificación se actualiza en tiempo real.',
    contest_note: 'Solo los suscriptores pueden votar. Cada usuario puede votar una sola vez.',
    songs_lowercase: 'canciones',
    vote_first: '1ª Opción',
    vote_second: '2ª Opción',
    vote_third: '3ª Opción',
    vote_selected: 'Has seleccionado',
    vote_submit: 'Enviar Voto',
    modal_thanks: '¡Gracias por votar!',
    modal_message: '¡Tus votos se han registrado correctamente!',
    search_placeholder: 'Buscar canciones...',
    search_empty: 'No se encontraron resultados.',
    back: '← Volver',
    count_days: 'Días',
    count_hours: 'Horas',
    count_mins: 'Min',
    count_secs: 'Seg',
    recent_badge: 'VISTOS RECIENTEMENTE',
    recent_title: 'Escuchaste Recientemente',
    about_pt_1: 'PROFEF es un proyecto musical que combina la creatividad humana y la Inteligencia Artificial para dar vida a canciones originales.',
    about_pt_2: 'Cada canción empieza mucho antes de la melodía. Todo comienza con una idea, una emoción, un recuerdo, un viaje o un lugar especial. A partir de ahí se escriben letras 100% originales, creadas para contar historias, transmitir emociones y construir una conexión genuina con los oyentes.',
    about_pt_3: 'La producción musical se desarrolla con el apoyo de la Inteligencia Artificial, utilizada como herramienta creativa para transformar esas historias en música. La IA no reemplaza la creatividad humana; es un instrumento que permite explorar nuevos estilos, sonidos y posibilidades musicales.',
    about_pt_4: 'El proyecto abarca varios géneros, como folk, pop, country, rock alternativo, música latina, Soul/Blues y baladas cinematográficas, manteniendo siempre la misma identidad: cada canción cuenta una historia.',
    about_pt_5: 'Más que crear canciones, PROFEF busca ofrecer experiencias, llevando al oyente a un viaje por lugares reales e imaginarios, reviviendo recuerdos y descubriendo nuevas emociones a través de la música.',
    about_pt_6: 'Este es un proyecto que demuestra cómo la creatividad humana y la tecnología pueden trabajar juntas para crear algo verdaderamente único.',
    about_pt_quote: '"Toda gran historia merece una banda sonora." 🎵',
    artist_badge: 'EL ARTISTA',
    artist_pt_1: 'La música siempre ha sido más que una pasión para PROFEF: es una forma de contar historias, despertar emociones y convertir recuerdos en canciones.',
    artist_pt_2: 'Cada canción nace de una idea, un lugar, un viaje o un momento memorable. Desde los fiordos de Islandia hasta las calles de Italia, desde las aventuras en Interrail hasta campos interminables cubiertos de flores, cada composición invita al oyente a un viaje único donde la imaginación y la realidad se entrelazan.',
    artist_pt_3: 'Las letras son completamente originales, escritas para transmitir emociones, contar historias y conectar con los oyentes. La producción musical aprovecha el potencial de la Inteligencia Artificial como herramienta creativa, explorando nuevos sonidos y posibilidades musicales sin comprometer jamás la originalidad de las ideas y las narrativas.',
    artist_pt_4: 'Sin atarse a un solo género musical, PROFEF explora sonidos que van desde el folk hasta el pop, desde el country hasta el rock alternativo, incluyendo Soul/Blues, baladas cinematográficas y melodías inspiradoras. El hilo conductor es siempre el mismo: historias que merecen ser escuchadas.',
    artist_pt_5: 'Cada lanzamiento busca crear una experiencia diferente, con letras originales, portadas cuidadosamente diseñadas y una identidad única que valora la emoción por encima de todo.',
    artist_pt_6: 'PROFEF cree que la tecnología puede ser una aliada de la creatividad. Cuando la imaginación humana y la Inteligencia Artificial trabajan juntas, es posible dar vida a canciones únicas que inspiran, conmueven y se quedan en la memoria.',
    artist_pt_7: 'Porque, para PROFEF, una buena canción no es solo la que escuchas… es la que te acompaña mucho después de que termina.',
    gallery_badge: 'GALERÍA',
    gallery_title: 'Portadas de Álbumes',
    ranking_badge: 'CLASIFICACIÓN',
    ranking_title: 'Clasificación',
    ranking_desc: 'Las canciones más votadas por la comunidad.',
    stats_badge: 'ESTADÍSTICAS',
    stats_title: 'Estadísticas',
    stats_desc: 'Datos generales de todas las canciones y votos.',
    admin_title: 'Panel de Administración',
    admin_login_title: 'Acceso de Administrador',
    admin_login_text: 'Introduce la contraseña para acceder al panel.',
    admin_password: 'Contraseña',
    admin_login_btn: 'Iniciar Sesión',
    admin_login_error: 'Contraseña incorrecta.',
    admin_export_csv: 'Exportar CSV',
    admin_export_json: 'Exportar JSON',
    admin_reset: 'Restablecer Votos',
    admin_logout: 'Cerrar Sesión',
    admin_total_votes: 'Votos Totales',
    admin_total_songs: 'Canciones',
    admin_groups: 'Géneros',
    admin_voting: 'Votación',
    admin_ranking: 'Clasificación General',
    admin_song: 'Canción',
    admin_group: 'Grupo',
    admin_votes: 'Votos',
    admin_manage_songs: 'Gestionar Canciones',
    admin_add_song: 'Añadir Canción',
    admin_edit_song: 'Editar Canción',
    admin_delete_song: 'Eliminar Canción',
    admin_save_song: 'Guardar',
    admin_cancel: 'Cancelar',
    admin_confirm_delete: '¿Estás seguro de que quieres eliminar esta canción?',
    admin_export_songs_js: 'Exportar songs.js',
    admin_import_json: 'Importar JSON',
    admin_no_songs: 'No se encontraron canciones.',
    admin_song_added: '¡Canción añadida correctamente!',
    admin_song_edited: '¡Canción editada correctamente!',
    admin_song_deleted: '¡Canción eliminada correctamente!',
    admin_field_title: 'Título',
    admin_field_artist: 'Artista',
    admin_field_group: 'Año',
    admin_field_date: 'Fecha de Lanzamiento',
    admin_field_style: 'Estilo',
    admin_field_mood: 'Ánimo',
    admin_field_cover: 'Portada (ruta)',
    admin_field_audio: 'Audio (ruta)',
    admin_field_youtube: 'YouTube',
    admin_field_description: 'Descripción (PT)',
    admin_field_description_en: 'Descripción (EN)',
    admin_field_description_es: 'Descripción (ES)',
    admin_field_description_fr: 'Descripción (FR)',
    admin_field_description_it: 'Descripción (IT)',
    admin_field_lyrics: 'Letra (Inglés)',
    admin_field_lyrics_pt: 'Letra (Portugués)',
    admin_field_lyrics_lang: 'Idioma de la Letra',
    voting_open: 'Votación Abierta',
    voting_closed: 'Votación Cerrada',
    share: 'Compartir',
    favorite: 'Favorito',
    unfavorite: 'Eliminar Favorito',
    stats_total_votes: 'Votos Totales',
    stats_avg_per_song: 'Promedio por Canción',
    stats_most_voted: 'Más Votada',
    tooltip_listen: 'Escuchar',
    tooltip_youtube_preview: 'Vista previa en YouTube',
    tooltip_click_to_vote: 'Haz clic para votar',
    tooltip_view_details: 'Ver detalles',
    tooltip_click_to_zoom: 'Haz clic para ampliar',
    tooltip_enter_group: 'Entrar al Grupo',
    group_label: 'Grupo',
    top_songs: 'Canciones Más Escuchadas',
    no_data: 'Sin datos',
    songs_label: 'canciones',
    lyrics_label: 'LETRA',
    lang_english: 'INGLÉS',
    lang_portuguese: 'PORTUGUÉS',
    lang_spanish: 'ESPAÑOL',
    lang_french: 'FRANCÉS',
    lang_italian: 'ITALIANO',
    behind_the_song: 'DETRÁS DE LA CANCIÓN',
    behind_the_song_en: 'DETRÁS DE LA CANCIÓN',
    already_voted_group: '¡Ya votaste en la clasificación!',
    your_votes: 'Tus votos:',
    hof_no_votes: 'Aún no hay votos. ¡Sé el primero en votar!',
    song_of_the_day: 'CANCIÓN DEL DÍA',
    tooltip_back: 'Volver',
    tooltip_open_youtube: 'Abrir en YouTube',
    tooltip_view_youtube_channel: 'Ver canal de YouTube',
    tooltip_share_song: 'Compartir canción',
    tooltip_add_favorites: 'Añadir a favoritos',
    tooltip_view: 'Ver',
    tooltip_open: 'Abrir',
    tooltip_close: 'Cerrar',
    cover_enlarged: 'Portada ampliada',
    voting_closed_alert: 'La votación está cerrada.',
    already_voted_phase: '¡Ya votaste en la clasificación!',
    link_copied: '¡Enlace copiado!',
    share_text_pt: 'Escucha',
    share_text_pt2: 'en PROFEF…',
    admin_confirm_reset: '¿Estás seguro de que quieres eliminar todos los votos?',
    tooltip_enter_password: 'Introduce la contraseña',
    tooltip_enter_admin: 'Acceder al panel de administración',
    tooltip_back_home: 'Volver a la página principal',
    tooltip_export_csv: 'Exportar datos a CSV',
    tooltip_export_json: 'Exportar datos a JSON',
    tooltip_reset_votes: 'Eliminar todos los votos',
    tooltip_admin_logout: 'Cerrar sesión del panel de administración',
    tooltip_close_voting: 'Cerrar votación',
    tooltip_open_voting: 'Abrir votación',
    group_badge_label: 'GRUPO',
    requests_badge: 'SOLICITUDES',
    requests_title: 'Solicitar una Canción',
    requests_desc: '¿Tienes una idea para una canción? Compártenos tu tema y crearemos una canción especialmente para ti.',
    req_name_label: 'Tu nombre',
    req_title_label: 'Título de la canción',
    req_theme_label: 'Tema / Idea para la letra',
    req_style_label: 'Estilo musical',
    req_mood_label: 'Emoción / Ánimo',
    req_email_label: 'Correo electrónico (opcional)',
    req_submit: 'Enviar Solicitud',
    req_success_title: '¡Solicitud enviada!',
    req_success_text: '¡Gracias! Tu solicitud se ha registrado. Cuando la canción esté creada, aparecerá en una sección aparte del catálogo.',
    req_another: 'Enviar otra solicitud',
    req_completed_badge: 'CREADA',
    req_completed_title: 'Canciones Creadas a partir de Solicitudes',
    req_pedido_de: 'Solicitud de',
    req_status_pending: 'Pendiente',
    req_status_approved: 'Aprobada',
    req_status_rejected: 'Rechazada',
    req_status_completed: 'Creada',
    admin_requests: 'Solicitudes de Canciones',
    quotes_badge: 'CITAS',
    quotes_title: 'Palabras que Inspiran',
    sub_login_title: 'Iniciar Sesión',
    sub_login_text: 'Inicia sesión para acceder a funciones exclusivas.',
    sub_register_title: 'Suscribirse',
    sub_register_text: 'Regístrate para votar, solicitar canciones y guardar favoritos.',
    sub_email_label: 'Correo electrónico',
    sub_password_label: 'Contraseña',
    sub_name_label: 'Nombre',
    sub_login_btn: 'Iniciar Sesión',
    sub_register_btn: 'Registrarse',
    sub_logout_btn: 'Cerrar Sesión',
    sub_no_account: '¿No tienes una cuenta?',
    sub_register_link: 'Registrarse',
    sub_has_account: '¿Ya tienes una cuenta?',
    sub_login_link: 'Iniciar Sesión',
    sub_login_tooltip: 'Iniciar Sesión / Registrarse',
    sub_my_profile: 'Mi Perfil',
    sub_enter: 'Iniciar Sesión',
    sub_error_fields: 'Por favor, rellena todos los campos.',
    sub_error_password: 'La contraseña debe tener al menos 6 caracteres.',
    sub_error_exists: 'Ya existe una cuenta con este correo electrónico.',
    sub_error_invalid: 'Correo electrónico o contraseña no válidos.',
    sub_stat_favorites: 'Favoritos',
    sub_stat_requests: 'Solicitudes',
    sub_stat_votes: 'Votos',
    sub_joined: 'Se unió',
    admin_subscribers: 'Suscriptores',
    sub_required_title: 'Suscriptor necesario',
    sub_required_text: 'Esta función es exclusiva para suscriptores. Suscríbete gratis para acceder.',
    sub_required_btn: 'Suscribirse',
    styles_badge: 'ESTILOS',
    styles_title: 'Canciones por Género',
    styles_desc: 'Explora el catálogo por estilo musical. Cada género cuenta una historia diferente.',
    styles_songs: 'canciones',
    styles_no_songs: 'Aún no hay canciones en este estilo.',
    comments_badge: 'COMENTARIOS',
    comments_title: '¿Qué te parece esta canción?',
    comments_rules_title: 'Normas de la Comunidad',
    comments_rule1: 'Sé respetuoso. Todos los gustos son válidos.',
    comments_rule2: 'Sin spam, publicidad ni contenido ofensivo.',
    comments_rule3: 'Comentarios adecuados. La violencia y el contenido inapropiado serán eliminados.',
    comments_rule4: 'Solo los suscriptores pueden comentar.',
    comments_placeholder: 'Escribe tu comentario...',
    comments_submit: 'Enviar',
    comments_login_to_comment: 'Inicia sesión para comentar.',
    comments_empty: 'Aún no hay comentarios. ¡Sé el primero!',
    comments_delete: 'Eliminar',
    comments_confirm_delete: '¿Eliminar este comentario?',
    privacy_title: 'Política de Privacidad',
    privacy_last_updated: 'Última actualización: Julio 2026',
    privacy_p1_title: '1. Información que recopilamos',
    privacy_p1_text: 'Solo recopilamos la información que proporcionas directamente: correo electrónico (al suscribirte, registrarte en la newsletter o enviar solicitudes de canciones), nombre (al crear una cuenta), dirección IP (para control de votos) y datos de navegación (páginas visitadas, tiempo de permanencia).',
    privacy_p2_title: '2. Cómo utilizamos tus datos',
    privacy_p2_text: 'Utilizamos tus datos exclusivamente para: gestionar tu cuenta de suscriptor, procesar votos y solicitudes de canciones, enviar newsletters (si estás suscrito), mejorar la experiencia de navegación y garantizar la seguridad del sitio.',
    privacy_p3_title: '3. Compartición de datos',
    privacy_p3_text: 'No vendemos, compartimos ni distribuimos tus datos personales con terceros. Los datos se almacenan localmente en tu navegador (localStorage) y no se transmiten a servidores externos.',
    privacy_p4_title: '4. Cookies',
    privacy_p4_text: 'El sitio utiliza cookies esenciales para el funcionamiento (preferencias de tema, idioma, estado de inicio de sesión). No utilizamos cookies de rastreo de terceros.',
    privacy_p5_title: '5. Tus derechos',
    privacy_p5_text: 'Tienes derecho a: acceder a tus datos, editar tu perfil, eliminar tu cuenta en cualquier momento y rechazar cookies. Para ejercer estos derechos, utiliza las opciones disponibles en tu perfil de suscriptor.',
    privacy_p6_title: '6. Seguridad',
    privacy_p6_text: 'Utilizamos hashing SHA-256 para proteger las contraseñas. Sin embargo, ningún sistema es 100% seguro. Recomendamos el uso de contraseñas fuertes y únicas.',
    privacy_p7_title: '7. Contacto',
    privacy_p7_text: 'Para preguntas sobre privacidad, contáctanos a través de Facebook o YouTube.',
    error_404_title: 'Página no encontrada',
    error_404_desc: 'Lo que buscas no existe. Puede que haya cambiado de dirección.',
    error_404_home: 'Volver al Inicio',
    sub_edit_btn: '✏️ Editar',
    sub_edit_title: 'Editar Perfil',
    sub_edit_new_password: 'Nueva contraseña (dejar vacío para mantener)',
    sub_edit_save: 'Guardar Cambios',
    sub_edit_delete_account: '⚠️ Eliminar Cuenta',
    sub_edit_cancel: '← Volver',
    sub_edit_error_fields: 'Por favor, completa todos los campos.',
    sub_edit_error_password: 'La contraseña debe tener al menos 6 caracteres.',
    sub_edit_error_current_password: 'Contraseña actual incorrecta.',
    sub_edit_success: '¡Perfil actualizado con éxito!',
    sub_edit_confirm_delete: '¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es irreversible y perderás todos tus datos (favoritos, votos, solicitudes).',
    cookie_text: 'Este sitio utiliza cookies para mejorar tu experiencia. Al continuar, aceptas nuestra Política de Privacidad.',
    cookie_accept: 'Aceptar',
    cookie_decline: 'Rechazar',
    footer_privacy: 'Política de Privacidad'
  },
  fr: {
    hero_badge: 'CHAQUE CHANSON RACONTE UNE HISTOIRE',
    hero_subtitle: 'MUSIQUE CRÉÉE PAR IA · PAROLES ORIGINALES',
    hero_songs: 'Chansons',
    hero_stories: 'Histoires',
    hero_vision: 'Vision',
    hero_cta: 'Explorer les chansons →',
    nav_home: 'Accueil',
    nav_songs: 'Chansons',
    nav_about: 'À propos',
    nav_ranking: 'Classement',
    nav_styles: 'Styles',
    nav_requests: 'Demandes',
    nav_statistics: 'Statistiques',
    about_badge: 'À PROPOS DU PROJET',
    about_title: 'Créativité humaine + IA',
    about_preview_1: 'PROFEF est un projet musical qui allie créativité humaine et Intelligence Artificielle pour donner vie à des chansons originales. Chaque chanson commence bien avant la mélodie — tout commence par une idée, une émotion, un souvenir, un voyage ou un lieu particulier.',
    about_preview_2: 'Les paroles sont 100% originales, écrites pour raconter des histoires et créer des liens avec les auditeurs. La production musicale utilise l\'IA comme un outil créatif, sans jamais compromettre l\'originalité.',
    about_more: 'En savoir plus →',
    songs_badge: 'CATALOGUE',
    songs_title: 'Toutes les chansons',
    songs_desc: 'Chansons originales. Chacune raconte une histoire différente.',
    songs_all: 'Toutes',
    featured_title: 'Dernières sorties',
    featured_desc: 'Explorez le catalogue complet de chansons originales.',
    featured_all: 'Voir toutes les chansons →',
    ranking_badge: 'CLASSEMENT',
    ranking_title: 'Vote + Classement',
    ranking_desc: 'Choisissez vos 3 chansons préférées parmi toutes. Le classement se met à jour en temps réel.',
    contest_title: 'Comment fonctionne le concours',
    contest_step1: 'Choisissez jusqu\'à 3 chansons dans tout le catalogue qui vous touchent le plus.',
    contest_step2: 'Classez-les par ordre de préférence : 1er, 2e et 3e choix.',
    contest_step3: 'Soumettez votre vote et voyez le classement se mettre à jour en temps réel !',
    contest_note: 'Seuls les abonnés peuvent voter. Chaque utilisateur ne peut voter qu\'une seule fois.',
    songs_lowercase: 'chansons',
    vote_first: '1er choix',
    vote_second: '2e choix',
    vote_third: '3e choix',
    vote_selected: 'Vous avez sélectionné',
    vote_submit: 'Soumettre le vote',
    modal_thanks: 'Merci d\'avoir voté !',
    modal_message: 'Vos votes ont été enregistrés avec succès !',
    search_placeholder: 'Rechercher des chansons...',
    search_empty: 'Aucun résultat trouvé.',
    back: '← Retour',
    count_days: 'Jours',
    count_hours: 'Heures',
    count_mins: 'Min',
    count_secs: 'Sec',
    recent_badge: 'RÉCEMMENT ÉCOUTÉS',
    recent_title: 'Vous avez récemment écouté',
    about_pt_1: 'PROFEF est un projet musical qui allie créativité humaine et Intelligence Artificielle pour donner vie à des chansons originales.',
    about_pt_2: 'Chaque chanson commence bien avant la mélodie. Tout commence par une idée, une émotion, un souvenir, un voyage ou un lieu particulier. De là, des paroles 100% originales sont écrites, créées pour raconter des histoires, transmettre des émotions et établir un lien authentique avec les auditeurs.',
    about_pt_3: 'La production musicale est réalisée avec le soutien de l\'Intelligence Artificielle, utilisée comme un outil créatif pour transformer ces histoires en musique. L\'IA ne remplace pas la créativité humaine ; c\'est un instrument qui permet d\'explorer de nouveaux styles, de nouveaux sons et de nouvelles possibilités musicales.',
    about_pt_4: 'Le projet couvre divers genres, tels que le folk, le pop, le country, le rock alternatif, la musique latine, le Soul/Blues et les ballades cinématographiques, tout en conservant toujours la même identité : chaque chanson raconte une histoire.',
    about_pt_5: 'Plus que de créer des chansons, PROFEF vise à offrir des expériences, emmenant l\'auditeur en voyage à travers des lieux réels et imaginaires, revivant des souvenirs et découvrant de nouvelles émotions à travers la musique.',
    about_pt_6: 'C\'est un projet qui démontre comment la créativité humaine et la technologie peuvent travailler ensemble pour créer quelque chose de véritablement unique.',
    about_pt_quote: '"Chaque grande histoire mérite une bande sonore." 🎵',
    artist_badge: 'L\'ARTISTE',
    artist_pt_1: 'La musique a toujours été plus qu\'une passion pour PROFEF — c\'est une manière de raconter des histoires, d\'éveiller des émotions et de transformer des souvenirs en chansons.',
    artist_pt_2: 'Chaque chanson naît d\'une idée, d\'un lieu, d\'un voyage ou d\'un moment mémorable. Des fjords d\'Islande aux rues d\'Italie, des aventures Interrail aux champs infinis couverts de fleurs, chaque composition invite l\'auditeur en voyage unique où imagination et réalité s\'entrelacent.',
    artist_pt_3: 'Les paroles sont entièrement originales, écrites pour transmettre des émotions, raconter des histoires et créer un lien avec les auditeurs. La production musicale exploite le potentiel de l\'Intelligence Artificielle comme outil créatif, explorant de nouveaux sons et de nouvelles possibilités musicales sans jamais compromettre l\'originalité des idées et des récits.',
    artist_pt_4: 'Sans être lié à un seul genre musical, PROFEF explore des sons allant du folk au pop, du country au rock alternatif, en passant par le Soul/Blues, les ballades cinématographiques et les mélodies inspirantes. Le fil conducteur est toujours le même : des histoires qui valent la peine d\'être entendues.',
    artist_pt_5: 'Chaque sortie cherche à créer une expérience différente, avec des paroles originales, une pochette soigneusement conçue et une identité unique qui valorise l\'émotion avant tout.',
    artist_pt_6: 'PROFEF croit que la technologie peut être une alliée de la créativité. Quand l\'imagination humaine et l\'Intelligence Artificielle travaillent ensemble, il est possible de donner vie à des chansons uniques qui inspirent, émeuvent et restent en mémoire.',
    artist_pt_7: 'Parce que, pour PROFEF, une bonne chanson n\'est pas seulement celle que l\'on entend... c\'est celle qui reste avec vous bien après qu\'elle se soit terminée.',
    gallery_badge: 'GALERIE',
    gallery_title: 'Pochettes d\'albums',
    ranking_badge: 'CLASSEMENT',
    ranking_title: 'Classement',
    ranking_desc: 'Les chansons les plus votées par la communauté.',
    stats_badge: 'STATISTIQUES',
    stats_title: 'Statistiques',
    stats_desc: 'Données générales de toutes les chansons et de tous les votes.',
    admin_title: 'Tableau de bord admin',
    admin_login_title: 'Accès administrateur',
    admin_login_text: 'Entrez le mot de passe pour accéder au tableau de bord.',
    admin_password: 'Mot de passe',
    admin_login_btn: 'Connexion',
    admin_login_error: 'Mot de passe incorrect.',
    admin_export_csv: 'Exporter CSV',
    admin_export_json: 'Exporter JSON',
    admin_reset: 'Réinitialiser les votes',
    admin_logout: 'Déconnexion',
    admin_total_votes: 'Total des votes',
    admin_total_songs: 'Chansons',
    admin_groups: 'Genres',
    admin_voting: 'Votes',
    admin_ranking: 'Classement général',
    admin_song: 'Chanson',
    admin_group: 'Groupe',
    admin_votes: 'Votes',
    admin_manage_songs: 'Gérer les chansons',
    admin_add_song: 'Ajouter une chanson',
    admin_edit_song: 'Modifier la chanson',
    admin_delete_song: 'Supprimer la chanson',
    admin_save_song: 'Enregistrer',
    admin_cancel: 'Annuler',
    admin_confirm_delete: 'Êtes-vous sûr de vouloir supprimer cette chanson ?',
    admin_export_songs_js: 'Exporter songs.js',
    admin_import_json: 'Importer JSON',
    admin_no_songs: 'Aucune chanson trouvée.',
    admin_song_added: 'Chanson ajoutée avec succès !',
    admin_song_edited: 'Chanson modifiée avec succès !',
    admin_song_deleted: 'Chanson supprimée avec succès !',
    admin_field_title: 'Titre',
    admin_field_artist: 'Artiste',
    admin_field_group: 'Année',
    admin_field_date: 'Date de sortie',
    admin_field_style: 'Style',
    admin_field_mood: 'Ambiance',
    admin_field_cover: 'Pochette (chemin)',
    admin_field_audio: 'Audio (chemin)',
    admin_field_youtube: 'YouTube',
    admin_field_description: 'Description (PT)',
    admin_field_description_en: 'Description (EN)',
    admin_field_description_es: 'Description (ES)',
    admin_field_description_fr: 'Description (FR)',
    admin_field_description_it: 'Description (IT)',
    admin_field_lyrics: 'Paroles (anglais)',
    admin_field_lyrics_pt: 'Paroles (portugais)',
    admin_field_lyrics_lang: 'Langue des paroles',
    voting_open: 'Votes ouverts',
    voting_closed: 'Votes fermés',
    share: 'Partager',
    favorite: 'Favori',
    unfavorite: 'Retirer des favoris',
    stats_total_votes: 'Total des votes',
    stats_avg_per_song: 'Moyenne par chanson',
    stats_most_voted: 'Les plus votées',
    tooltip_listen: 'Écouter',
    tooltip_youtube_preview: 'Aperçu sur YouTube',
    tooltip_click_to_vote: 'Cliquer pour voter',
    tooltip_view_details: 'Voir les détails',
    tooltip_click_to_zoom: 'Cliquer pour agrandir',
    tooltip_enter_group: 'Entrer dans le groupe',
    group_label: 'Groupe',
    top_songs: 'Top chansons',
    no_data: 'Aucune donnée',
    songs_label: 'chansons',
    lyrics_label: 'PAROLES',
    lang_english: 'ANGLAIS',
    lang_portuguese: 'PORTUGAIS',
    lang_spanish: 'ESPAGNOL',
    lang_french: 'FRANÇAIS',
    lang_italian: 'ITALIEN',
    behind_the_song: 'LES COULISSES DE LA CHANSON',
    behind_the_song_en: 'LES COULISSES DE LA CHANSON',
    already_voted_group: 'Vous avez déjà voté dans le classement !',
    your_votes: 'Vos votes :',
    hof_no_votes: 'Pas encore de votes. Soyez le premier à voter !',
    song_of_the_day: 'CHANSON DU JOUR',
    tooltip_back: 'Retour',
    tooltip_open_youtube: 'Ouvrir sur YouTube',
    tooltip_view_youtube_channel: 'Voir la chaîne YouTube',
    tooltip_share_song: 'Partager la chanson',
    tooltip_add_favorites: 'Ajouter aux favoris',
    tooltip_view: 'Voir',
    tooltip_open: 'Ouvrir',
    tooltip_close: 'Fermer',
    cover_enlarged: 'Pochette agrandie',
    voting_closed_alert: 'Les votes sont fermés.',
    already_voted_phase: 'Vous avez déjà voté dans le classement !',
    link_copied: 'Lien copié !',
    share_text_pt: 'Écouter',
    share_text_pt2: 'sur PROFEF...',
    admin_confirm_reset: 'Êtes-vous sûr de vouloir supprimer tous les votes ?',
    tooltip_enter_password: 'Entrer le mot de passe',
    tooltip_enter_admin: 'Accéder au tableau de bord admin',
    tooltip_back_home: 'Retour à l\'accueil',
    tooltip_export_csv: 'Exporter les données en CSV',
    tooltip_export_json: 'Exporter les données en JSON',
    tooltip_reset_votes: 'Supprimer tous les votes',
    tooltip_admin_logout: 'Déconnexion du panneau admin',
    tooltip_close_voting: 'Fermer les votes',
    tooltip_open_voting: 'Ouvrir les votes',
    group_badge_label: 'GROUPE',
    requests_badge: 'DEMANDES',
    requests_title: 'Demander une chanson',
    requests_desc: 'Vous avez une idée de chanson ? Partagez votre thème avec nous et nous créerons une chanson spécialement pour vous.',
    req_name_label: 'Votre nom',
    req_title_label: 'Titre de la chanson',
    req_theme_label: 'Thème / Idée de paroles',
    req_style_label: 'Style musical',
    req_mood_label: 'Émotion / Ambiance',
    req_email_label: 'E-mail (facultatif)',
    req_submit: 'Soumettre la demande',
    req_success_title: 'Demande soumise !',
    req_success_text: 'Merci ! Votre demande a été enregistrée. Lorsque la chanson sera créée, elle apparaîtra dans une section séparée du catalogue.',
    req_another: 'Soumettre une autre demande',
    req_completed_badge: 'CRÉÉES',
    req_completed_title: 'Chansons créées à partir de demandes',
    req_pedido_de: 'Demande par',
    req_status_pending: 'En attente',
    req_status_approved: 'Approuvée',
    req_status_rejected: 'Rejetée',
    req_status_completed: 'Créée',
    admin_requests: 'Demandes de chansons',
    quotes_badge: 'CITATIONS',
    quotes_title: 'Des mots qui inspirent',
    sub_login_title: 'Se connecter',
    sub_login_text: 'Connectez-vous pour accéder aux fonctionnalités exclusives.',
    sub_register_title: 'Devenir abonné',
    sub_register_text: 'Inscrivez-vous pour voter, demander des chansons et enregistrer vos favoris.',
    sub_email_label: 'E-mail',
    sub_password_label: 'Mot de passe',
    sub_name_label: 'Nom',
    sub_login_btn: 'Se connecter',
    sub_register_btn: 'S\'inscrire',
    sub_logout_btn: 'Se déconnecter',
    sub_no_account: 'Vous n\'avez pas de compte ?',
    sub_register_link: 'S\'inscrire',
    sub_has_account: 'Vous avez déjà un compte ?',
    sub_login_link: 'Se connecter',
    sub_login_tooltip: 'Se connecter / S\'inscrire',
    sub_my_profile: 'Mon profil',
    sub_enter: 'Se connecter',
    sub_error_fields: 'Veuillez remplir tous les champs.',
    sub_error_password: 'Le mot de passe doit contenir au moins 6 caractères.',
    sub_error_exists: 'Un compte avec cet e-mail existe déjà.',
    sub_error_invalid: 'E-mail ou mot de passe invalide.',
    sub_stat_favorites: 'Favoris',
    sub_stat_requests: 'Demandes',
    sub_stat_votes: 'Votes',
    sub_joined: 'Inscrit le',
    admin_subscribers: 'Abonnés',
    sub_required_title: 'Abonnement requis',
    sub_required_text: 'Cette fonctionnalité est exclusive aux abonnés. Inscrivez-vous gratuitement pour y accéder.',
    sub_required_btn: 'Devenir abonné',
    styles_badge: 'STYLES',
    styles_title: 'Chansons par genre',
    styles_desc: 'Explorez le catalogue par style musical. Chaque genre raconte une histoire différente.',
    styles_songs: 'chansons',
    styles_no_songs: 'Aucune chanson dans ce style pour le moment.',
    comments_badge: 'COMMENTAIRES',
    comments_title: 'Que pensez-vous de cette chanson ?',
    comments_rules_title: 'Règles de la Communauté',
    comments_rule1: 'Soyez respectueux. Tous les goûts sont valables.',
    comments_rule2: 'Pas de spam, de publicité ou de contenu offensant.',
    comments_rule3: 'Commentaires appropriés. La violence et le contenu inapproprié seront supprimés.',
    comments_rule4: 'Seuls les abonnés peuvent commenter.',
    comments_placeholder: 'Écrivez votre commentaire...',
    comments_submit: 'Soumettre',
    comments_login_to_comment: 'Connectez-vous pour commenter.',
    comments_empty: 'Pas encore de comments. Soyez le premier !',
    comments_delete: 'Supprimer',
    comments_confirm_delete: 'Supprimer ce commentaire ?',
    privacy_title: 'Politique de Confidentialité',
    privacy_last_updated: 'Dernière mise à jour : Juillet 2026',
    privacy_p1_title: '1. Informations que nous collectons',
    privacy_p1_text: 'Nous ne collectons que les informations que vous fournissez directement : e-mail (lors de l\'inscription, de l\'abonnement à la newsletter ou des demandes de chansons), nom (lors de la création du compte), adresse IP (pour le contrôle des votes) et données de navigation (pages visitées, temps passé).',
    privacy_p2_title: '2. Comment nous utilisons vos données',
    privacy_p2_text: 'Nous utilisons vos données exclusivement pour : gérer votre compte abonné, traiter les votes et les demandes de chansons, envoyer les newsletters (si abonné), améliorer l\'expérience de navigation et garantir la sécurité du site.',
    privacy_p3_title: '3. Partage des données',
    privacy_p3_text: 'Nous ne vendons, ne partageons ni ne distribuons vos données personnelles à des tiers. Les données sont stockées localement dans votre navigateur (localStorage) et ne sont pas transmises à des serveurs externes.',
    privacy_p4_title: '4. Cookies',
    privacy_p4_text: 'Le site utilise des cookies essentiels au fonctionnement (préférences de thème, langue, état de connexion). Nous n\'utilisons pas de cookies de traçage tiers.',
    privacy_p5_title: '5. Vos droits',
    privacy_p5_text: 'Vous avez le droit de : accéder à vos données, modifier votre profil, supprimer votre compte à tout moment et refuser les cookies. Pour exercer ces droits, utilisez les options disponibles dans votre profil abonné.',
    privacy_p6_title: '6. Sécurité',
    privacy_p6_text: 'Nous utilisons le hachage SHA-256 pour protéger les mots de passe. Cependant, aucun système n\'est sécurisé à 100 %. Nous recommandons l\'utilisation de mots de passe robustes et uniques.',
    privacy_p7_title: '7. Contact',
    privacy_p7_text: 'Pour des questions sur la confidentialité, contactez-nous via Facebook ou YouTube.',
    error_404_title: 'Page non trouvée',
    error_404_desc: 'La page que vous cherchez n\'existe pas. Elle a peut-être changé d\'adresse.',
    error_404_home: 'Retour à l\'Accueil',
    sub_edit_btn: '✏️ Modifier',
    sub_edit_title: 'Modifier le Profil',
    sub_edit_new_password: 'Nouveau mot de passe (laisser vide pour conserver)',
    sub_edit_save: 'Enregistrer',
    sub_edit_delete_account: '⚠️ Supprimer le Compte',
    sub_edit_cancel: '← Retour',
    sub_edit_error_fields: 'Veuillez remplir tous les champs.',
    sub_edit_error_password: 'Le mot de passe doit contenir au moins 6 caractères.',
    sub_edit_error_current_password: 'Mot de passe actuel incorrect.',
    sub_edit_success: 'Profil mis à jour avec succès !',
    sub_edit_confirm_delete: 'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible et vous perdrez toutes vos données (favoris, votes, demandes).',
    cookie_text: 'Ce site utilise des cookies pour améliorer votre expérience. En continuant, vous acceptez notre Politique de Confidentialité.',
    cookie_accept: 'Accepter',
    cookie_decline: 'Refuser',
    footer_privacy: 'Politique de Confidentialité'
  },
  it: {
    hero_badge: 'OGNI CANZONE RACCONTA UNA STORIA',
    hero_subtitle: 'MUSICA CREATA CON AI · TESTI ORIGINALI',
    hero_songs: 'Canzoni',
    hero_stories: 'Storie',
    hero_vision: 'Visione',
    hero_cta: 'Esplora le Canzoni →',
    nav_home: 'Home',
    nav_songs: 'Canzoni',
    nav_about: 'Chi siamo',
    nav_ranking: 'Classifica',
    nav_styles: 'Stili',
    nav_requests: 'Richieste',
    nav_statistics: 'Statistiche',
    about_badge: 'IL PROGETTO',
    about_title: 'Creatività Umana + AI',
    about_preview_1: 'PROFEF è un progetto musicale che combina la creatività umana e l\'Intelligenza Artificiale per dare vita a canzoni originali. Ogni canzone inizia molto prima della melodia — tutto ha inizio con un\'idea, un\'emozione, un ricordo, un viaggio o un luogo speciale.',
    about_preview_2: 'I testi sono al 100% originali, scritti per raccontare storie e creare connessioni con gli ascoltatori. La produzione musicale utilizza l\'AI come strumento creativo, mai compromettendo l\'originalità.',
    about_more: 'Scopri di più →',
    songs_badge: 'CATALOGO',
    songs_title: 'Tutte le Canzoni',
    songs_desc: 'Canzoni originali. Ognuna racconta una storia diversa.',
    songs_all: 'Tutte',
    featured_title: 'Ultime Uscite',
    featured_desc: 'Esplora il catalogo completo delle canzoni originali.',
    featured_all: 'Vedi Tutte le Canzoni →',
    ranking_badge: 'CLASSIFICA',
    ranking_title: 'Voto + Classifica',
    ranking_desc: 'Scegli le tue 3 canzoni preferite tra tutte. La classifica si aggiorna in tempo reale.',
    contest_title: 'Come Funziona il Concorso',
    contest_step1: 'Scegli fino a 3 canzoni dall\'intero catalogo che ti commuovono di più.',
    contest_step2: 'Ordinalle per preferenza: 1ª, 2ª e 3ª scelta.',
    contest_step3: 'Invia il tuo voto e guarda la classifica aggiornarsi in tempo reale!',
    contest_note: 'Solo gli abbonati possono votare. Ogni utente può votare una sola volta.',
    songs_lowercase: 'canzoni',
    vote_first: '1ª Scelta',
    vote_second: '2ª Scelta',
    vote_third: '3ª Scelta',
    vote_selected: 'Hai selezionato',
    vote_submit: 'Invia Voto',
    modal_thanks: 'Grazie per aver votato!',
    modal_message: 'I tuoi voti sono stati registrati con successo!',
    search_placeholder: 'Cerca canzoni...',
    search_empty: 'Nessun risultato trovato.',
    back: '← Indietro',
    count_days: 'Giorni',
    count_hours: 'Ore',
    count_mins: 'Min',
    count_secs: 'Sec',
    recent_badge: 'VISTI DI RECENTE',
    recent_title: 'Ascoltati di Recente',
    about_pt_1: 'PROFEF è un progetto musicale che combina la creatività umana e l\'Intelligenza Artificiale per dare vita a canzoni originali.',
    about_pt_2: 'Ogni canzone inizia molto prima della melodia. Tutto ha inizio con un\'idea, un\'emozione, un ricordo, un viaggio o un luogo speciale. Da lì vengono scritti testi al 100% originali, creati per raccontare storie, trasmettere emozioni e costruire una connessione genuina con gli ascoltatori.',
    about_pt_3: 'La produzione musicale è sviluppata con il supporto dell\'Intelligenza Artificiale, utilizzata come strumento creativo per trasformare queste storie in musica. L\'AI non sostituisce la creatività umana; è uno strumento che permette di esplorare nuovi stili, suoni e possibilità musicali.',
    about_pt_4: 'Il progetto abbraccia vari generi, come folk, pop, country, rock alternativo, musica latina, Soul/Blues e ballate cinematiche, mantenendo sempre la stessa identità: ogni canzone racconta una storia.',
    about_pt_5: 'Oltre a creare canzoni, PROFEF mira a fornire esperienze, portando l\'ascoltatore in un viaggio attraverso luoghi reali e immaginari, rivivendo ricordi e scoprendo nuove emozioni attraverso la musica.',
    about_pt_6: 'Questo è un progetto che dimostra come la creatività umana e la tecnologia possono lavorare insieme per creare qualcosa di veramente unico.',
    about_pt_quote: '"Ogni grande storia merita una colonna sonora." 🎵',
    artist_badge: 'L\'ARTISTA',
    artist_pt_1: 'La musica è sempre stata molto più di una passione per PROFEF — è un modo per raccontare storie, risvegliare emozioni e trasformare ricordi in canzoni.',
    artist_pt_2: 'Ogni canzone nasce da un\'idea, un luogo, un viaggio o un momento memorabile. Dai fiordi dell\'Islanda alle strade dell\'Italia, dalle avventure in Interrail ai campi infiniti coperti di fiori, ogni composizione invita l\'ascoltatore in un viaggio unico dove immaginazione e realtà si intrecciano.',
    artist_pt_3: 'I testi sono interamente originali, scritti per trasmettere emozioni, raccontare storie e connettersi con gli ascoltatori. La produzione musicale sfrutta il potenziale dell\'Intelligenza Artificiale come strumento creativo, esplorando nuovi suoni e possibilità musicali senza mai compromettere l\'originalità delle idee e delle narrazioni.',
    artist_pt_4: 'Senza essere legato a un unico genere musicale, PROFEF esplora suoni che spaziano dal folk al pop, dal country al rock alternativo, includendo Soul/Blues, ballate cinematiche e melodie ispiratrici. Il filo conduttore è sempre lo stesso: storie che vale la pena ascoltare.',
    artist_pt_5: 'Ogni uscita cerca di creare un\'esperienza diversa, con testi originali, artwork accuratamente concepito e un\'identità unica che valorizza l\'emozione sopra ogni altra cosa.',
    artist_pt_6: 'PROFEF crede che la tecnologia possa essere un\'alleata della creatività. Quando l\'immaginazione umana e l\'Intelligenza Artificiale lavorano insieme, è possibile dare vita a canzoni uniche che ispirano, commuovono e restano nella memoria.',
    artist_pt_7: 'Perché, per PROFEF, una buona canzone non è solo quella che ascolti... è quella che resta con te molto dopo che è finita.',
    gallery_badge: 'GALLERIA',
    gallery_title: 'Copertine degli Album',
    ranking_badge: 'CLASSIFICA',
    ranking_title: 'Classifica',
    ranking_desc: 'Le canzoni più votate dalla community.',
    stats_badge: 'STATISTICHE',
    stats_title: 'Statistiche',
    stats_desc: 'Dati generali di tutte le canzoni e i voti.',
    admin_title: 'Pannello Admin',
    admin_login_title: 'Accesso Admin',
    admin_login_text: 'Inserisci la password per accedere al pannello.',
    admin_password: 'Password',
    admin_login_btn: 'Accedi',
    admin_login_error: 'Password errata.',
    admin_export_csv: 'Esporta CSV',
    admin_export_json: 'Esporta JSON',
    admin_reset: 'Azzera Voti',
    admin_logout: 'Esci',
    admin_total_votes: 'Voti Totali',
    admin_total_songs: 'Canzoni',
    admin_groups: 'Generi',
    admin_voting: 'Votazione',
    admin_ranking: 'Classifica Generale',
    admin_song: 'Canzone',
    admin_group: 'Gruppo',
    admin_votes: 'Voti',
    admin_manage_songs: 'Gestisci Canzoni',
    admin_add_song: 'Aggiungi Canzone',
    admin_edit_song: 'Modifica Canzone',
    admin_delete_song: 'Elimina Canzone',
    admin_save_song: 'Salva',
    admin_cancel: 'Annulla',
    admin_confirm_delete: 'Sei sicuro di voler eliminare questa canzone?',
    admin_export_songs_js: 'Esporta songs.js',
    admin_import_json: 'Importa JSON',
    admin_no_songs: 'Nessuna canzone trovata.',
    admin_song_added: 'Canzone aggiunta con successo!',
    admin_song_edited: 'Canzone modificata con successo!',
    admin_song_deleted: 'Canzone eliminata con successo!',
    admin_field_title: 'Titolo',
    admin_field_artist: 'Artista',
    admin_field_group: 'Anno',
    admin_field_date: 'Data di Uscita',
    admin_field_style: 'Stile',
    admin_field_mood: 'Atmosfera',
    admin_field_cover: 'Copertina (percorso)',
    admin_field_audio: 'Audio (percorso)',
    admin_field_youtube: 'YouTube',
    admin_field_description: 'Descrizione (PT)',
    admin_field_description_en: 'Descrizione (EN)',
    admin_field_description_es: 'Descrizione (ES)',
    admin_field_description_fr: 'Descrizione (FR)',
    admin_field_description_it: 'Descrizione (IT)',
    admin_field_lyrics: 'Testi (Inglese)',
    admin_field_lyrics_pt: 'Testi (Portoghese)',
    admin_field_lyrics_lang: 'Lingua dei Testi',
    voting_open: 'Votazione Aperta',
    voting_closed: 'Votazione Chiusa',
    share: 'Condividi',
    favorite: 'Preferito',
    unfavorite: 'Rimuovi Preferito',
    stats_total_votes: 'Voti Totali',
    stats_avg_per_song: 'Media per Canzone',
    stats_most_voted: 'Più Votate',
    tooltip_listen: 'Ascolta',
    tooltip_youtube_preview: 'Anteprima su YouTube',
    tooltip_click_to_vote: 'Clicca per votare',
    tooltip_view_details: 'Vedi dettagli',
    tooltip_click_to_zoom: 'Clicca per ingrandire',
    tooltip_enter_group: 'Entra nel Gruppo',
    group_label: 'Gruppo',
    top_songs: 'Canzoni Top',
    no_data: 'Nessun dato',
    songs_label: 'canzoni',
    lyrics_label: 'TESTI',
    lang_english: 'INGLESE',
    lang_portuguese: 'PORTOGHESE',
    lang_spanish: 'SPAGNOLO',
    lang_french: 'FRANCESE',
    lang_italian: 'ITALIANO',
    behind_the_song: 'DIETRO LA CANZONE',
    behind_the_song_en: 'DIETRO LA CANZONE',
    already_voted_group: 'Hai già votato nella classifica!',
    your_votes: 'I tuoi voti:',
    hof_no_votes: 'Nessun voto ancora. Sii il primo a votare!',
    song_of_the_day: 'CANZONE DEL GIORNO',
    tooltip_back: 'Indietro',
    tooltip_open_youtube: 'Apri su YouTube',
    tooltip_view_youtube_channel: 'Visualizza canale YouTube',
    tooltip_share_song: 'Condividi canzone',
    tooltip_add_favorites: 'Aggiungi ai preferiti',
    tooltip_view: 'Visualizza',
    tooltip_open: 'Apri',
    tooltip_close: 'Chiudi',
    cover_enlarged: 'Copertina ingrandita',
    voting_closed_alert: 'La votazione è chiusa.',
    already_voted_phase: 'Hai già votato nella classifica!',
    link_copied: 'Link copiato!',
    share_text_pt: 'Ascolta',
    share_text_pt2: 'su PROFEF...',
    admin_confirm_reset: 'Sei sicuro di voler eliminare tutti i voti?',
    tooltip_enter_password: 'Inserisci password',
    tooltip_enter_admin: 'Entra nel pannello admin',
    tooltip_back_home: 'Torna alla pagina iniziale',
    tooltip_export_csv: 'Esporta dati in CSV',
    tooltip_export_json: 'Esporta dati in JSON',
    tooltip_reset_votes: 'Elimina tutti i voti',
    tooltip_admin_logout: 'Esci dal pannello admin',
    tooltip_close_voting: 'Chiudi votazione',
    tooltip_open_voting: 'Apri votazione',
    group_badge_label: 'GRUPPO',
    requests_badge: 'RICHIESTE',
    requests_title: 'Richiedi una Canzone',
    requests_desc: 'Hai un\'idea per una canzone? Condividi il tuo tema con noi e creeremo una canzone appositamente per te.',
    req_name_label: 'Il tuo nome',
    req_title_label: 'Titolo della canzone',
    req_theme_label: 'Tema / Idea per il testo',
    req_style_label: 'Stile musicale',
    req_mood_label: 'Emozione / Atmosfera',
    req_email_label: 'Email (opzionale)',
    req_submit: 'Invia Richiesta',
    req_success_title: 'Richiesta inviata!',
    req_success_text: 'Grazie! La tua richiesta è stata registrata. Quando la canzone sarà creata, apparirà in una sezione separata del catalogo.',
    req_another: 'Invia un\'altra richiesta',
    req_completed_badge: 'CREATA',
    req_completed_title: 'Canzoni Create dalle Richieste',
    req_pedido_de: 'Richiesta di',
    req_status_pending: 'In attesa',
    req_status_approved: 'Approvata',
    req_status_rejected: 'Rifiutata',
    req_status_completed: 'Creata',
    admin_requests: 'Richieste Canzoni',
    quotes_badge: 'CITAZIONI',
    quotes_title: 'Parole che Ispirano',
    sub_login_title: 'Accedi',
    sub_login_text: 'Accedi per accedere a funzionalità esclusive.',
    sub_register_title: 'Diventa Abbonato',
    sub_register_text: 'Registrati per votare, richiedere canzoni e salvare i preferiti.',
    sub_email_label: 'Email',
    sub_password_label: 'Password',
    sub_name_label: 'Nome',
    sub_login_btn: 'Accedi',
    sub_register_btn: 'Registrati',
    sub_logout_btn: 'Esci',
    sub_no_account: 'Non hai un account?',
    sub_register_link: 'Registrati',
    sub_has_account: 'Hai già un account?',
    sub_login_link: 'Accedi',
    sub_login_tooltip: 'Accedi / Registrati',
    sub_my_profile: 'Il Mio Profilo',
    sub_enter: 'Accedi',
    sub_error_fields: 'Per favore compila tutti i campi.',
    sub_error_password: 'La password deve avere almeno 6 caratteri.',
    sub_error_exists: 'Esiste già un account con questa email.',
    sub_error_invalid: 'Email o password non validi.',
    sub_stat_favorites: 'Preferiti',
    sub_stat_requests: 'Richieste',
    sub_stat_votes: 'Voti',
    sub_joined: 'Iscritto',
    admin_subscribers: 'Abbonati',
    sub_required_title: 'Abbonamento necessario',
    sub_required_text: 'Questa funzionalità è esclusiva degli abbonati. Registrati gratuitamente per accedere.',
    sub_required_btn: 'Diventa Abbonato',
    styles_badge: 'STILI',
    styles_title: 'Canzoni per Genere',
    styles_desc: 'Esplora il catalogo per stile musicale. Ogni genere racconta una storia diversa.',
    styles_songs: 'canzoni',
    styles_no_songs: 'Nessuna canzone in questo stile ancora.',
    comments_badge: 'COMMENTI',
    comments_title: 'Cosa ne pensi di questa canzone?',
    comments_rules_title: 'Regole della Community',
    comments_rule1: 'Sii rispettoso. Tutti i gusti sono validi.',
    comments_rule2: 'Nessuno spam, pubblicità o contenuto offensivo.',
    comments_rule3: 'Commenti appropriati. Violenza e contenuti inappropriati saranno rimossi.',
    comments_rule4: 'Solo gli abbonati possono commentare.',
    comments_placeholder: 'Scrivi il tuo commento...',
    comments_submit: 'Invia',
    comments_login_to_comment: 'Accedi per lasciare un commento.',
    comments_empty: 'Nessun commento ancora. Sii il primo!',
    comments_delete: 'Elimina',
    comments_confirm_delete: 'Eliminare questo commento?',
    privacy_title: 'Privacy Policy',
    privacy_last_updated: 'Ultimo aggiornamento: Luglio 2026',
    privacy_p1_title: '1. Informazioni che raccogliamo',
    privacy_p1_text: 'Raccogliamo solo le informazioni che fornisci direttamente: email (quando ti iscrivi, abbonati alla newsletter o invii richieste di canzoni), nome (quando crei un account), indirizzo IP (per il controllo dei voti) e dati di navigazione (pagine visitate, tempo di permanenza).',
    privacy_p2_title: '2. Come utilizziamo i tuoi dati',
    privacy_p2_text: 'Utilizziamo i tuoi dati esclusivamente per: gestire il tuo account abbonato, processare voti e richieste di canzoni, inviare newsletter (se abbonato), migliorare l\'esperienza di navigazione e garantire la sicurezza del sito.',
    privacy_p3_title: '3. Condivisione dei dati',
    privacy_p3_text: 'Non vendiamo, condividiamo o distribuiamo i tuoi dati personali a terzi. I dati sono memorizzati localmente nel tuo browser (localStorage) e non vengono trasmessi a server esterni.',
    privacy_p4_title: '4. Cookie',
    privacy_p4_text: 'Il sito utilizza cookie essenziali per il funzionamento (preferenze di tema, lingua, stato di login). Non utilizziamo cookie di tracciamento di terze parti.',
    privacy_p5_title: '5. I tuoi diritti',
    privacy_p5_text: 'Hai il diritto di: accedere ai tuoi dati, modificare il tuo profilo, eliminare il tuo account in qualsiasi momento e rifiutare i cookie. Per esercitare questi diritti, utilizza le opzioni disponibili nel tuo profilo abbonato.',
    privacy_p6_title: '6. Sicurezza',
    privacy_p6_text: 'Utilizziamo l\'hashing SHA-256 per proteggere le password. Tuttavia, nessun sistema è sicuro al 100%. Consigliamo l\'utilizzo di password robuste e uniche.',
    privacy_p7_title: '7. Contatto',
    privacy_p7_text: 'Per domande sulla privacy, contattaci tramite Facebook o YouTube.',
    error_404_title: 'Pagina non trovata',
    error_404_desc: 'La pagina che cerchi non esiste. Potrebbe aver cambiato indirizzo.',
    error_404_home: 'Torna alla Home',
    sub_edit_btn: '✏️ Modifica',
    sub_edit_title: 'Modifica Profilo',
    sub_edit_new_password: 'Nuova password (lascia vuoto per mantenere)',
    sub_edit_save: 'Salva Modifiche',
    sub_edit_delete_account: '⚠️ Elimina Account',
    sub_edit_cancel: '← Indietro',
    sub_edit_error_fields: 'Compila tutti i campi.',
    sub_edit_error_password: 'La password deve contenere almeno 6 caratteri.',
    sub_edit_error_current_password: 'Password attuale errata.',
    sub_edit_success: 'Profilo aggiornato con successo!',
    sub_edit_confirm_delete: 'Sei sicuro di voler eliminare il tuo account? Quest\'azione è irreversibile e perderai tutti i tuoi dati (preferiti, voti, richieste).',
    cookie_text: 'Questo sito utilizza cookie per migliorare la tua esperienza. Continuando, accetti la nostra Privacy Policy.',
    cookie_accept: 'Accetta',
    cookie_decline: 'Rifiuta',
    footer_privacy: 'Privacy Policy'
  }
};

let currentLang = Storage.get('lang') || 'pt';

/**
 * Aplicar idioma a todos os elementos data-i18n
 */
function applyLanguage() {
  const dict = i18n[currentLang];
  if (!dict) return;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.documentElement.lang = currentLang;

  // Update search placeholder
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.placeholder = dict.search_placeholder || 'Pesquisar...';
  }

  // Update lang toggle
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

/**
 * Trocar idioma
 */
function setLanguage(lang) {
  currentLang = lang;
  Storage.set('lang', lang);
  applyLanguage();
  // Re-renderizar a página atual sem mudar de página
  if (currentPage) {
    switch (currentPage) {
      case 'home':
        updateHeroSongCount();
        renderSongOfTheDay();
        renderRecentlyViewed();
        renderFeaturedSongs();
        renderQuotes();
        renderCoverGallery();
        break;
      case 'songs':
        renderAllSongsPage();
        break;
      case 'song':
        const songHash = window.location.hash.split('/')[1];
        if (songHash) {
          const song = getSongById(parseInt(songHash));
          if (song) renderSongDetail(song);
        }
        break;
      case 'ranking':
        renderRankingPage();
        break;
      case 'statistics':
        renderStatistics();
        break;
      case 'requests':
        renderRequestsPage();
        break;
      case 'styles':
        renderStylesPage();
        break;
      case 'privacy':
        renderPrivacyPolicy();
        break;
    }
  }
}


/* ═══════════════════════════════════════════════════════════════
   THEME MODULE
   ═══════════════════════════════════════════════════════════════ */
let currentTheme = Storage.get('theme') || 'dark';

function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const btn = document.querySelector('.nav-theme-btn');
  if (btn) {
    btn.textContent = currentTheme === 'dark' ? '🌙' : '☀️';
  }
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  Storage.set('theme', currentTheme);
  applyTheme();
}


/* ═══════════════════════════════════════════════════════════════
   VOTING SYSTEM — Com proteção por IP
   ═══════════════════════════════════════════════════════════════ */
let selectedVotes = [];
let votingContext = null;

/**
 * Verificar se a votação está aberta
 */
function isVotingOpen() {
  const status = Storage.get('voting_status');
  return status !== 'closed';
}

/**
 * Verificar se já votou num contexto (localStorage)
 */
function hasVoted(context) {
  const votes = Storage.get('votes') || {};
  return !!votes[context];
}

/**
 * Obter votos de um contexto
 */
function getVotes(context) {
  const votes = Storage.get('votes') || {};
  return votes[context] || [];
}

/**
 * Guardar votos + registar IP
 */
function saveVotes(context, voteIds) {
  const votes = Storage.get('votes') || {};
  votes[context] = voteIds;
  Storage.set('votes', votes);

  // Registar IP
  registerIPVote(context);

  // Registar no histórico global
  const allVotes = Storage.get('all_votes') || [];
  voteIds.forEach((id, index) => {
    allVotes.push({
      songId: id,
      position: index + 1,
      context: context,
      timestamp: Date.now(),
      ip: userIP
    });
  });
  Storage.set('all_votes', allVotes);
}

/**
 * Iniciar sessão de votação
 */
function startVoting(context) {
  if (!isVotingOpen()) {
    alert(i18n[currentLang].voting_closed_alert);
    return;
  }

  if (!canVote(context)) {
    alert(i18n[currentLang].already_voted_phase);
    return;
  }

  selectedVotes = [];
  votingContext = context;
  updateVotingPanel();
}


/* ═══════════════════════════════════════════════════════════════
   ROUTER — Single Page Application
   ═══════════════════════════════════════════════════════════════ */
let currentPage = 'home';
let previousPage = 'home';
let currentGroup = null;

/**
 * Navegar para uma página
 * @param {string} page - Nome da página
 * @param {string|null} param - Parâmetro opcional (ex: grupo 'A')
 */
/**
 * Atualizar contagem de músicas no hero
 */
function updateHeroSongCount() {
  const el = document.getElementById('heroSongCount');
  if (el) el.textContent = songs.length;
}

function navigateTo(page, param) {
  // Guardar página anterior
  if (currentPage !== page) {
    previousPage = currentPage;
  }

  // Esconder todas as páginas
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Mostrar página pretendida
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) {
    pageEl.classList.add('active', 'page-transition');
    // Remover classe de transição após animação
    setTimeout(() => pageEl.classList.remove('page-transition'), 400);
  }

  // Atualizar nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  currentPage = page;

  // Lógica específica por página
  switch (page) {
    case 'home':
      updateHeroSongCount();
      renderRecentlyViewed();
      renderFeaturedSongs();
      break;

    case 'songs':
      renderAllSongsPage();
      break;

    case 'about':
      // Página estática, não precisa de renderização
      break;

    case 'ranking':
      renderRankingPage();
      break;

    case 'requests':
      renderRequestsPage();
      break;

    case 'statistics':
      renderStatistics();
      break;

    case 'styles':
      renderStylesPage();
      break;

    case 'song':
      renderSongDetail(param);
      break;

    case 'privacy':
      renderPrivacyPolicy();
      break;

    case '404':
      // Página estática, não precisa de renderização
      break;
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Esconder voting panel quando não está em fase de voto
  const votingPanel = document.getElementById('votingPanel');
  if (votingPanel) {
    if (page === 'ranking' && canVote('ranking')) {
      votingPanel.classList.add('visible');
    } else {
      votingPanel.classList.remove('visible');
    }
  }
}

/**
 * Renderizar músicas em destaque na home
 */
function renderFeaturedSongs() {
  const grid = document.getElementById('featuredSongsGrid');
  if (!grid) return;

  // Mostrar as 8 últimas músicas
  const featured = songs.slice(-8);
  grid.innerHTML = featured.map(song => createSongCard(song, { showFav: true })).join('');
}

/**
 * Renderizar página de todas as músicas
 */
function renderAllSongsPage() {
  const grid = document.getElementById('allSongsGrid');
  if (!grid) return;

  grid.innerHTML = songs.map(song => createSongCard(song, { showFav: true })).join('');
}

/**
 * Filtrar músicas (simplificado — mostra todas)
 */
// Navegação via URL hash
function handleHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    navigateTo('home');
    return;
  }

  if (hash.startsWith('admin')) {
    initAdmin();
    return;
  }

  const parts = hash.split('/');
  const page = parts[0];
  const param = parts[1] || null;

  if (page === 'song' && param) {
    navigateTo(page, param);
  } else if (page === 'privacy') {
    navigateTo('privacy');
  } else if (['home', 'songs', 'about', 'ranking', 'styles', 'requests', 'statistics'].includes(page)) {
    navigateTo(page);
  } else {
    navigateTo('404');
  }
}

window.addEventListener('hashchange', handleHash);


/* ═══════════════════════════════════════════════════════════════
   IP TRACKING — 1 pessoa = 1 voto
   ═══════════════════════════════════════════════════════════════ */
let userIP = null;

/**
 * Obter IP do utilizador (via API gratuita)
 */
async function fetchUserIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    userIP = data.ip;
    Storage.set('user_ip', userIP);
  } catch (e) {
    // Se falhar, usar fallback do localStorage
    userIP = Storage.get('user_ip') || 'unknown';
  }
}

/**
 * Verificar se o IP já votou em algum contexto
 */
function hasIPVoted(context) {
  if (!userIP) return false;
  const ipVotes = Storage.get('ip_votes') || {};
  const votedIPs = ipVotes[context] || [];
  return votedIPs.includes(userIP);
}

/**
 * Registar o IP como tendo votado
 */
function registerIPVote(context) {
  if (!userIP) return;
  const ipVotes = Storage.get('ip_votes') || {};
  if (!ipVotes[context]) ipVotes[context] = [];
  if (!ipVotes[context].includes(userIP)) {
    ipVotes[context].push(userIP);
  }
  Storage.set('ip_votes', ipVotes);
}

/**
 * Verificar se pode votar (combina IP + localStorage)
 */
function canVote(context) {
  return isVotingOpen() && !hasVoted(context) && !hasIPVoted(context);
}

/**
 * Toggle seleção de uma música
 */
function toggleVote(songId) {
  if (!isVotingOpen()) return;
  if (hasVoted(votingContext)) return;

  const index = selectedVotes.indexOf(songId);
  if (index > -1) {
    // Remover
    selectedVotes.splice(index, 1);
  } else if (selectedVotes.length < 3) {
    // Adicionar
    selectedVotes.push(songId);
  }

  updateVotingPanel();
  updateSongCards();
}

/**
 * Atualizar painel de votação
 */
function updateVotingPanel() {
  const count = selectedVotes.length;
  const voteCountEl = document.getElementById('voteCount');
  if (!voteCountEl) return;
  voteCountEl.textContent = count;

  // Atualizar choices
  for (let i = 1; i <= 3; i++) {
    const choiceEl = document.getElementById('choice' + i);
    if (!choiceEl) continue;
    const song = selectedVotes[i - 1] ? getSongById(selectedVotes[i - 1]) : null;

    if (song) {
      choiceEl.classList.add('filled');
      choiceEl.innerHTML = `
        <span class="voting-choice-emoji">${['🥇', '🥈', '🥉'][i - 1]}</span>
        <span>${song.title}</span>
      `;
    } else {
      choiceEl.classList.remove('filled');
      choiceEl.innerHTML = `
        <span class="voting-choice-emoji">${['🥇', '🥈', '🥉'][i - 1]}</span>
        <span>${i18n[currentLang]['vote_' + ['first', 'second', 'third'][i - 1]]}</span>
      `;
    }
  }

  // Botão submit
  const submitBtn = document.getElementById('submitVoteBtn');
  if (submitBtn) submitBtn.disabled = count !== 3;
}

/**
 * Atualizar visual dos cards de música
 */
function updateSongCards() {
  document.querySelectorAll('.song-card').forEach(card => {
    const id = parseInt(card.dataset.songId);
    const selectedIndex = selectedVotes.indexOf(id);

    card.classList.toggle('selected', selectedIndex > -1);

    // Remover badge anterior
    const existingBadge = card.querySelector('.vote-badge');
    if (existingBadge) existingBadge.remove();

    // Adicionar badge se selecionado
    if (selectedIndex > -1) {
      const badge = document.createElement('div');
      badge.className = 'vote-badge';
      badge.textContent = selectedIndex + 1;
      card.appendChild(badge);
    }
  });
}

/**
 * Submeter voto
 */
function submitVote() {
  if (selectedVotes.length !== 3 || !votingContext) return;

  saveVotes(votingContext, selectedVotes);

  // Mostrar modal de confirmação
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.add('open');

  // Reset
  selectedVotes = [];
  votingContext = null;
  updateVotingPanel();
  updateSongCards();

  // Re-renderizar a página atual para mostrar estado "já votou"
  if (currentPage === 'ranking') {
    renderRankingPage();
  }
}

/**
 * Fechar modal
 */
function closeModal() {
  document.getElementById('confirmModal').classList.remove('open');
}


/* ═══════════════════════════════════════════════════════════════
   RENDERING — Song Cards
   ═══════════════════════════════════════════════════════════════ */

/**
 * Criar HTML de um card de música
 */
function createSongCard(song, options = {}) {
  const { showVoteBadge = false, votePosition = 0, showFav = false, context = null } = options;

  const isFav = getFavorites().includes(song.id);

  let badgeHtml = '';
  if (showVoteBadge && votePosition > 0) {
    badgeHtml = `<div class="vote-badge">${votePosition}</div>`;
  }

  let favHtml = '';
  if (showFav) {
    favHtml = `
      <button class="fav-btn ${isFav ? 'active' : ''}" 
              onclick="event.stopPropagation(); toggleFavorite(${song.id})" 
              data-tooltip="${isFav ? i18n[currentLang].unfavorite : i18n[currentLang].favorite}">
        ${isFav ? '❤️' : '🤍'}
      </button>
    `;
  }

  return `
    <div class="song-card" 
         data-song-id="${song.id}" 
         onclick="navigateTo('song', ${song.id})"
         data-tooltip="${i18n[currentLang].tooltip_listen} ${song.title}"
         style="animation: fadeInUp 0.5s ease ${Math.random() * 0.3}s both;">
      ${badgeHtml}
      ${favHtml}
      <div class="song-card-cover">
        <img src="${song.cover}" alt="${song.title}" loading="lazy" draggable="false" class="no-download"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%231b1b1d%22 width=%22200%22 height=%22200%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2240%22>♪</text></svg>'">
        <div class="song-card-cover-overlay">
          <div class="song-card-play" data-tooltip="${i18n[currentLang].tooltip_youtube_preview}">▶</div>
        </div>
      </div>
      <div class="song-card-title">${song.title}</div>
      <div class="song-card-artist">${song.artist}</div>
    </div>
  `;
}

/**
 * Criar card de música com votação
 */
function createVoteableSongCard(song, context) {
  const userCanVote = canVote(context);
  const votes = getVotes(context);
  const voteIdx = votes.indexOf(song.id);
  const isSelected = voteIdx > -1;

  let badgeHtml = '';
  if (isSelected) {
    badgeHtml = `<div class="vote-badge">${voteIdx + 1}</div>`;
  }

  const onclick = userCanVote
    ? `onclick="handleVoteCardClick(${song.id}, '${context}')" data-tooltip="${i18n[currentLang].tooltip_click_to_vote} ${song.title}"`
    : `onclick="navigateTo('song', ${song.id})" data-tooltip="${i18n[currentLang].tooltip_view_details} ${song.title}"`;

  return `
    <div class="song-card ${isSelected ? 'selected' : ''}"
         data-song-id="${song.id}"
         ${onclick}
         style="animation: fadeInUp 0.5s ease ${Math.random() * 0.3}s both;">
      ${badgeHtml}
      <div class="song-card-cover">
        <img src="${song.cover}" alt="${song.title}" loading="lazy" draggable="false" class="no-download"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%231b1b1d%22 width=%22200%22 height=%22200%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2240%22>♪</text></svg>'">
        <div class="song-card-cover-overlay">
          <div class="song-card-play" data-tooltip="${i18n[currentLang].tooltip_youtube_preview}">▶</div>
        </div>
      </div>
      <div class="song-card-title">${song.title}</div>
      <div class="song-card-artist">${song.artist}</div>
      ${!userCanVote && isSelected ? `<div style="position:absolute;top:0.5rem;left:0.5rem;font-size:0.65rem;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.3);border-radius:50px;padding:0.2rem 0.6rem;color:#D4AF37;font-weight:600;">#${voteIdx + 1}</div>` : ''}
    </div>
  `;
}

/**
 * Handle click no card votável
 */
function handleVoteCardClick(songId, context) {
  if (!isSubscriber()) {
    openSubscriberModal();
    return;
  }
  if (!votingContext || votingContext !== context) {
    startVoting(context);
  }
  toggleVote(songId);
}


/* ═══════════════════════════════════════════════════════════════
   RENDERING — Song Detail
   ═══════════════════════════════════════════════════════════════ */
function renderSongDetail(songId) {
  const song = getSongById(parseInt(songId));
  if (!song) return;

  // Adicionar aos vistos recentemente
  addRecentlyViewed(song.id);
  trackPlay(song.id);

  const hero = document.getElementById('songDetailHero');
  hero.innerHTML = `
    <div class="song-detail-cover no-download-cover" onclick="openLightbox('${song.cover}', '${song.title}')" data-tooltip="${i18n[currentLang].tooltip_click_to_zoom}">
      <img src="${song.cover}" alt="${song.title}" draggable="false" class="no-download"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 400%22><rect fill=%22%231b1b1d%22 width=%22400%22 height=%22400%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2280%22>♪</text></svg>'">
      <div class="zoom-hint">🔍</div>
    </div>
    <div class="song-detail-info">
      <div class="song-detail-label">${song.date ? new Date(song.date).getFullYear() + ' — ' : ''}PROFEF</div>
      <h1 class="song-detail-title">${song.title}</h1>
      <p class="song-detail-artist">${song.artist}</p>
      <p class="song-detail-description">${song['description_' + currentLang] || song.description}</p>
      <div class="song-detail-tags">
        <span class="song-detail-tag">${song.style}</span>
        <span class="song-detail-tag">${song.mood}</span>
        ${song.date ? `<span class="song-detail-tag">${new Date(song.date).getFullYear()}</span>` : ''}
        <span class="song-detail-tag">▶ ${getPlayCount(song.id)}</span>
      </div>
      <div class="song-detail-actions">
        <button class="btn btn-primary btn-sm" onclick="navigateTo(previousPage)" data-tooltip="${i18n[currentLang].tooltip_back}">
          ${i18n[currentLang].back}
        </button>
        ${song.youtube ? (extractYouTubeId(song.youtube)
          ? `<button class="btn btn-secondary btn-sm" onclick="openYouTube(${song.id})" data-tooltip="${i18n[currentLang].tooltip_open_youtube}">▶ YouTube</button>`
          : `<a href="${song.youtube}" target="_blank" class="btn btn-secondary btn-sm" data-tooltip="${i18n[currentLang].tooltip_view_youtube_channel}">▶ YouTube</a>`
        ) : ''}
        <div class="share-group">
          <button class="btn btn-ghost btn-sm" onclick="toggleShareMenu(${song.id})" data-tooltip="${i18n[currentLang].tooltip_share_song}">🔗 ${i18n[currentLang].share}</button>
          <div class="share-menu" id="shareMenu-${song.id}">
            <button onclick="shareToWhatsApp(${song.id})" title="WhatsApp">💬 WhatsApp</button>
            <button onclick="shareToFacebook(${song.id})" title="Facebook">📘 Facebook</button>
            <button onclick="copySongLink(${song.id})" title="Copiar link" class="share-copy-btn">📋 Copiar</button>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="toggleFavorite(${song.id})" id="favBtnDetail" data-tooltip="${i18n[currentLang].tooltip_add_favorites}">
          ${getFavorites().includes(song.id) ? '❤️' : '🤍'} ${i18n[currentLang].favorite}
        </button>
      </div>
    </div>
  `;

  // Lyrics section
  const lyricsContainer = document.getElementById('songDetailLyrics');
  if (lyricsContainer) {
    if (song.lyrics && song.lyrics.trim()) {
      const hasPt = song.lyrics_pt && song.lyrics_pt.trim();

      if (hasPt) {
        const langCode = song.lyrics_lang || 'en';
        const langLabel = i18n[currentLang]['lang_' + langCode] || langCode.toUpperCase();
        lyricsContainer.innerHTML = `
          <div class="lyrics-section">
            <div class="lyrics-title">LETRAS</div>
            <div class="lyrics-columns">
              <div class="lyrics-column">
                <h4>${langLabel}</h4>
                <div class="lyrics-text">${song.lyrics}</div>
              </div>
              <div class="lyrics-column">
                <h4>${i18n[currentLang].lang_portuguese}</h4>
                <div class="lyrics-text">${song.lyrics_pt}</div>
              </div>
            </div>
          </div>
        `;
      } else {
        lyricsContainer.innerHTML = `
          <div class="lyrics-section">
            <div class="lyrics-title">LETRAS</div>
            <div class="lyrics-text">${song.lyrics}</div>
          </div>
        `;
      }
      lyricsContainer.style.display = '';
    } else {
      lyricsContainer.innerHTML = '';
      lyricsContainer.style.display = 'none';
    }
  }

  // Behind the Song section
  const behindContainer = document.getElementById('songDetailBehind');
  if (behindContainer) {
    if (song.behind && song.behind.trim()) {
      const lang = currentLang;
      const label = i18n[currentLang].behind_the_song;
      behindContainer.innerHTML = `
        <div class="behind-the-song">
          <div class="behind-the-song-label">${label}</div>
          <div class="behind-the-song-text">${song.behind}</div>
        </div>
      `;
      behindContainer.style.display = '';
    } else {
      behindContainer.innerHTML = '';
      behindContainer.style.display = 'none';
    }
  }

  // Comments section
  renderComments(song.id);
}

/* ═══════════════════════════════════════════════════════════════
   COMMENTS — Sistema de comentários por música
   ═══════════════════════════════════════════════════════════════ */
function getComments(songId) {
  const all = Storage.get('song_comments') || {};
  return all[songId] || [];
}

function saveComment(songId, comment) {
  const all = Storage.get('song_comments') || {};
  if (!all[songId]) all[songId] = [];
  all[songId].unshift(comment);
  Storage.set('song_comments', all);
}

function deleteComment(songId, commentIdx) {
  const all = Storage.get('song_comments') || {};
  if (all[songId]) {
    all[songId].splice(commentIdx, 1);
    Storage.set('song_comments', all);
  }
}

function renderComments(songId) {
  const container = document.getElementById('songDetailComments');
  if (!container) return;
  const L = i18n[currentLang];
  const comments = getComments(songId);
  const logged = isSubscriber();
  const sub = getCurrentSubscriber();

  let rulesHtml = `
    <div class="comments-rules">
      <div class="comments-rules-title">📋 ${L.comments_rules_title}</div>
      <div class="comments-rule"><span class="comments-rule-num">1</span> ${L.comments_rule1}</div>
      <div class="comments-rule"><span class="comments-rule-num">2</span> ${L.comments_rule2}</div>
      <div class="comments-rule"><span class="comments-rule-num">3</span> ${L.comments_rule3}</div>
      <div class="comments-rule"><span class="comments-rule-num">4</span> ${L.comments_rule4}</div>
    </div>
  `;

  let formHtml = '';
  if (logged) {
    formHtml = `
      <form class="comments-form" onsubmit="event.preventDefault(); postComment(${songId});">
        <div class="comments-form-avatar">${(sub.name || '?')[0].toUpperCase()}</div>
        <div class="comments-form-body">
          <input type="text" id="commentInput-${songId}" class="comments-input" placeholder="${L.comments_placeholder}" maxlength="500" autocomplete="off">
          <button type="submit" class="btn btn-primary btn-sm comments-submit-btn">${L.comments_submit}</button>
        </div>
      </form>
    `;
  } else {
    formHtml = `
      <div class="comments-login-hint" onclick="openSubscriberModal()">
        ${L.comments_login_to_comment} →
      </div>
    `;
  }

  let listHtml = '';
  if (comments.length === 0) {
    listHtml = `<div class="comments-empty">${L.comments_empty}</div>`;
  } else {
    listHtml = '<div class="comments-list">' + comments.map((c, idx) => {
      const isAdmin = sub && sub.role === 'admin';
      const canDelete = logged && (c.email === sub.email || isAdmin);
      return `
        <div class="comment-item" style="animation: fadeInUp 0.3s ease ${idx * 0.05}s both;">
          <div class="comment-avatar">${(c.name || '?')[0].toUpperCase()}</div>
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-name">${escapeHtml(c.name)}</span>
              <span class="comment-date">${formatCommentDate(c.timestamp)}</span>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
          ${canDelete ? `<button class="comment-delete-btn" onclick="confirmDeleteComment(${songId}, ${idx})" title="${L.comments_delete}">✕</button>` : ''}
        </div>
      `;
    }).join('') + '</div>';
  }

  container.innerHTML = `
    <div class="comments-section">
      <div class="comments-section-title">💬 ${L.comments_badge}</div>
      <p class="comments-section-subtitle">${L.comments_title}</p>
      ${rulesHtml}
      ${formHtml}
      ${listHtml}
    </div>
  `;
}

function postComment(songId) {
  const L = i18n[currentLang];
  const input = document.getElementById('commentInput-' + songId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const sub = getCurrentSubscriber();
  if (!sub) { openSubscriberModal(); return; }

  const comment = {
    name: sub.name,
    email: sub.email,
    text: text,
    timestamp: Date.now()
  };

  saveComment(songId, comment);
  renderComments(songId);
}

function confirmDeleteComment(songId, idx) {
  const L = i18n[currentLang];
  if (confirm(L.comments_confirm_delete)) {
    deleteComment(songId, idx);
    renderComments(songId);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatCommentDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  const localeMap = { pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT' };
  const locale = localeMap[currentLang] || 'pt-PT';
  const agoMap = { pt: 'atrás', en: 'ago', es: 'hace', fr: 'il y a', it: 'fa' };
  const ago = agoMap[currentLang] || 'atrás';
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'min ' + ago;
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ' + ago;
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ' + ago;
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}


/* ═══════════════════════════════════════════════════════════════
   FAVORITES
   ═══════════════════════════════════════════════════════════════ */
function getFavorites() {
  return Storage.get('favorites') || [];
}

function toggleFavorite(songId) {
  if (!isSubscriber()) {
    openSubscriberModal();
    return;
  }
  const favs = getFavorites();
  const idx = favs.indexOf(songId);
  if (idx > -1) {
    favs.splice(idx, 1);
  } else {
    favs.push(songId);
  }
  Storage.set('favorites', favs);

  // Atualizar UI
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const card = btn.closest('.song-card');
    if (card && parseInt(card.dataset.songId) === songId) {
      const isFav = favs.includes(songId);
      btn.classList.toggle('active', isFav);
      btn.innerHTML = isFav ? '❤️' : '🤍';
    }
  });
}


/* ═══════════════════════════════════════════════════════════════
   RECENTLY VIEWED
   ═══════════════════════════════════════════════════════════════ */
function getRecentlyViewed() {
  return Storage.get('recently_viewed') || [];
}

function addRecentlyViewed(songId) {
  let recent = getRecentlyViewed();
  recent = recent.filter(id => id !== songId);
  recent.unshift(songId);
  if (recent.length > 10) recent = recent.slice(0, 10);
  Storage.set('recently_viewed', recent);
}

function trackPlay(songId) {
  const plays = Storage.get('play_counts') || {};
  plays[songId] = (plays[songId] || 0) + 1;
  Storage.set('play_counts', plays);
}

function getPlayCount(songId) {
  const plays = Storage.get('play_counts') || {};
  return plays[songId] || 0;
}

function getTotalPlays() {
  const plays = Storage.get('play_counts') || {};
  return Object.values(plays).reduce((sum, n) => sum + n, 0);
}

function renderRecentlyViewed() {
  const recent = getRecentlyViewed();
  const section = document.getElementById('recentSection');
  const scroll = document.getElementById('recentScroll');

  if (recent.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  scroll.innerHTML = recent.map(id => {
    const song = getSongById(id);
    if (!song) return '';
    return `
      <div class="recently-viewed-item" onclick="navigateTo('song', ${song.id})" data-tooltip="${i18n[currentLang].tooltip_view} ${song.title}">
        <div class="recently-viewed-cover">
          <img src="${song.cover}" alt="${song.title}" loading="lazy" draggable="false" class="no-download"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231b1b1d%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2224%22>♪</text></svg>'">
        </div>
        <div class="recently-viewed-title">${song.title}</div>
      </div>
    `;
  }).join('');
}


/* ═══════════════════════════════════════════════════════════════
   SEARCH
   ═══════════════════════════════════════════════════════════════ */
let searchFilter = 'all';

function toggleSearch() {
  const overlay = document.getElementById('searchOverlay');
  overlay.classList.toggle('open');

  if (overlay.classList.contains('open')) {
    setTimeout(() => document.getElementById('searchInput').focus(), 300);
  } else {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
  }
}

function setSearchFilter(filter) {
  searchFilter = filter;
  document.querySelectorAll('.search-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  performSearch(document.getElementById('searchInput').value);
}

function performSearch(query) {
  const results = document.getElementById('searchResults');
  const q = query.toLowerCase().trim();

  if (q.length < 2) {
    results.innerHTML = '';
    return;
  }

  let filtered = songs.filter(song => {
    const matchQuery = song.title.toLowerCase().includes(q) ||
                       song.artist.toLowerCase().includes(q) ||
                       song.description.toLowerCase().includes(q) ||
                       (song.lyrics && song.lyrics.toLowerCase().includes(q)) ||
                       (song.lyrics_pt && song.lyrics_pt.toLowerCase().includes(q));
    const matchFilter = searchFilter === 'all' || song.style === searchFilter;
    return matchQuery && matchFilter;
  });

  if (filtered.length === 0) {
    results.innerHTML = `<div class="search-empty">${i18n[currentLang].search_empty}</div>`;
    return;
  }

  results.innerHTML = filtered.map(song => `
    <div class="search-result-item" onclick="toggleSearch(); navigateTo('song', ${song.id})" data-tooltip="${i18n[currentLang].tooltip_open} ${song.title}">
      <div class="search-result-cover">
        <img src="${song.cover}" alt="${song.title}" loading="lazy" draggable="false" class="no-download"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22><rect fill=%22%231b1b1d%22 width=%2248%22 height=%2248%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2216%22>♪</text></svg>'">
      </div>
      <div class="search-result-info">
        <div class="search-result-title">${song.title}</div>
        <div class="search-result-meta">${song.style} · ${song.mood} ${song.date ? '· ' + new Date(song.date).getFullYear() : ''}</div>
      </div>
    </div>
  `).join('');
}


/* ═══════════════════════════════════════════════════════════════
   RANKING PAGE — Voting + Results
   ═══════════════════════════════════════════════════════════════ */
function renderRankingPage() {
  const context = 'ranking';
  const userCanVoteNow = canVote(context);
  const allVotes = Storage.get('all_votes') || [];
  const rankingContext = allVotes.filter(v => v.context === 'ranking');

  // Calcular pontuação: 1º = 3pts, 2º = 2pts, 3º = 1pt
  const scores = {};
  rankingContext.forEach(vote => {
    if (!scores[vote.songId]) scores[vote.songId] = 0;
    scores[vote.songId] += (4 - vote.position);
  });

  const playCounts = {};
  songs.forEach(s => {
    const pc = getPlayCount(s.id);
    if (pc > 0) playCounts[s.id] = pc;
  });

  const ranked = Object.entries(scores)
    .map(([id, score]) => ({ song: getSongById(parseInt(id)), score, plays: playCounts[id] || 0 }))
    .filter(item => item.song)
    .sort((a, b) => b.score - a.score || b.plays - a.plays);

  const podium = document.getElementById('rankingPodium');
  const rankingList = document.getElementById('rankingList');
  const contestRules = document.getElementById('rankingContestRules');
  const L = i18n[currentLang];

  // Instruções do concurso
  if (contestRules) {
    contestRules.innerHTML = `
      <div class="contest-rules">
        <h3 class="contest-rules-title">${L.contest_title}</h3>
        <div class="contest-rules-steps">
          <div class="contest-rule-step">
            <span class="contest-rule-num">1</span>
            <span>${L.contest_step1}</span>
          </div>
          <div class="contest-rule-step">
            <span class="contest-rule-num">2</span>
            <span>${L.contest_step2}</span>
          </div>
          <div class="contest-rule-step">
            <span class="contest-rule-num">3</span>
            <span>${L.contest_step3}</span>
          </div>
        </div>
        <p class="contest-rules-note">${L.contest_note}</p>
      </div>
    `;
  }

  // Podium (top 3)
  if (ranked.length === 0) {
    podium.innerHTML = `
      <div class="text-center" style="padding:3rem;color:var(--text-dim);">
        <p style="font-size:2rem;margin-bottom:1rem;">🏆</p>
        <p>${L.hof_no_votes}</p>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-top:0.5rem;">${L.ranking_desc}</p>
      </div>
    `;
  } else {
    const medals = ['🥈', '🥇', '🥉'];
    const podiumOrder = [1, 0, 2];

    podium.innerHTML = podiumOrder.map((order, i) => {
      const item = ranked[order];
      if (!item) return '';
      return `
        <div class="podium-item" onclick="navigateTo('song', ${item.song.id})" data-tooltip="${L.tooltip_view} ${item.song.title}" style="cursor:pointer;">
          <div class="podium-cover">
            <img src="${item.song.cover}" alt="${item.song.title}" loading="lazy"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 160 160%22><rect fill=%22%231b1b1d%22 width=%22160%22 height=%22160%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2240%22>♪</text></svg>'">
          </div>
          <div class="podium-position">${medals[i]}</div>
          <div class="podium-title">${item.song.title}</div>
          <div class="podium-votes">${item.score} pts</div>
          <div class="podium-stand">${i + 1}</div>
        </div>
      `;
    }).join('');
  }

  // Full ranking list
  if (ranked.length > 0) {
    rankingList.innerHTML = ranked.map((item, idx) => `
      <div class="ranking-item" onclick="navigateTo('song', ${item.song.id})" data-tooltip="${L.tooltip_view} ${item.song.title}" style="cursor:pointer; animation: fadeInUp 0.4s ease ${idx * 0.05}s both;">
        <div class="ranking-position">${idx + 1}</div>
        <div class="ranking-cover">
          <img src="${item.song.cover}" alt="${item.song.title}" loading="lazy"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 50 50%22><rect fill=%22%231b1b1d%22 width=%2250%22 height=%2250%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2214%22>♪</text></svg>'">
        </div>
        <div class="ranking-info">
          <div class="ranking-title">${item.song.title}</div>
          <div class="ranking-meta">${item.song.style} ${item.song.date ? '· ' + new Date(item.song.date).getFullYear() : ''}</div>
        </div>
        <div class="ranking-votes">${item.score} pts</div>
      </div>
    `).join('');
  } else {
    rankingList.innerHTML = '';
  }

  // Votável: grelha com todas as músicas para votar
  const voteSection = document.getElementById('rankingVoteSection');
  if (voteSection) {
    if (userCanVoteNow && songs.length > 0) {
      voteSection.innerHTML = `
        <div class="section-header" style="margin-top:2rem;">
          <div class="section-badge">${L.ranking_badge}</div>
          <h2 class="section-title">${L.ranking_title}</h2>
          <p class="section-description">${L.ranking_desc}</p>
        </div>
        <div class="songs-grid">
          ${songs.map(song => createVoteableSongCard(song, context)).join('')}
        </div>
      `;
    } else if (!userCanVoteNow && songs.length > 0) {
      voteSection.innerHTML = `
        <div class="section-header" style="margin-top:2rem;">
          <div class="section-badge">${L.ranking_badge}</div>
          <h2 class="section-title">${L.ranking_title}</h2>
        </div>
        <div class="songs-grid">
          ${songs.map(song => createSongCard(song, { showFav: true })).join('')}
        </div>
      `;
    } else {
      voteSection.innerHTML = '';
    }
  }

  // Inicializar sessão de votação (silenciosamente — sem alerts)
  if (userCanVoteNow && songs.length > 0) {
    selectedVotes = [];
    votingContext = context;
    updateVotingPanel();
  } else {
    selectedVotes = [];
    votingContext = null;
  }
}


/* ═══════════════════════════════════════════════════════════════
   STATISTICS
   ═══════════════════════════════════════════════════════════════ */
function renderStatistics() {
  const allVotes = Storage.get('all_votes') || [];
  const votesBySong = {};

  allVotes.forEach(v => {
    votesBySong[v.songId] = (votesBySong[v.songId] || 0) + 1;
  });

  const totalVotes = allVotes.length;
  const uniqueSongsVoted = Object.keys(votesBySong).length;
  const avgPerSong = uniqueSongsVoted > 0 ? (totalVotes / uniqueSongsVoted).toFixed(1) : 0;

  const mostVotedId = Object.entries(votesBySong).sort((a, b) => b[1] - a[1])[0];
  const mostVotedSong = mostVotedId ? getSongById(parseInt(mostVotedId[0])) : null;

  let totalPlays = 0;
  songs.forEach(s => { totalPlays += getPlayCount(s.id); });

  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stats-card">
      <div class="stats-card-title">${i18n[currentLang].stats_total_votes}</div>
      <div class="text-center" style="font-size:3rem;font-weight:900;color:#D4AF37;">${totalVotes}</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-title">${i18n[currentLang].stats_avg_per_song}</div>
      <div class="text-center" style="font-size:3rem;font-weight:900;color:#D4AF37;">${avgPerSong}</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-title">${i18n[currentLang].stats_most_voted}</div>
      <div class="text-center" style="font-size:1.2rem;font-weight:700;">
        ${mostVotedSong ? mostVotedSong.title : '—'}
      </div>
    </div>
    <div class="stats-card">
      <div class="stats-card-title">Total de Reproduções</div>
      <div class="text-center" style="font-size:3rem;font-weight:900;color:#D4AF37;">${totalPlays}</div>
    </div>

    <!-- Top songs -->
    <div class="stats-card" style="grid-column: span 2;">
      <div class="stats-card-title">${i18n[currentLang].top_songs}</div>
      ${Object.entries(votesBySong).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, count]) => {
        const song = getSongById(parseInt(id));
        if (!song) return '';
        const max = totalVotes || 1;
        const pct = (count / max * 100).toFixed(0);
        return `
          <div class="stats-bar">
            <div class="stats-bar-label">${song.title}</div>
            <div class="stats-bar-track">
              <div class="stats-bar-fill" style="width: ${pct}%"></div>
            </div>
            <div class="stats-bar-value">${count}</div>
          </div>
        `;
      }).join('') || `<div class="text-center text-dim" style="padding:1rem;">${i18n[currentLang].no_data}</div>`}
    </div>
  `;
}


/* ═══════════════════════════════════════════════════════════════
   PARTICLES
   ═══════════════════════════════════════════════════════════════ */
function createParticles() {
  const container = document.getElementById('particlesContainer');
  if (!container) return;

  const count = window.innerWidth < 768 ? 20 : 40;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (8 + Math.random() * 12) + 's';
    particle.style.animationDelay = Math.random() * 10 + 's';
    particle.style.width = (2 + Math.random() * 3) + 'px';
    particle.style.height = particle.style.width;
    particle.style.opacity = 0.2 + Math.random() * 0.4;
    container.appendChild(particle);
  }
}


/* ═══════════════════════════════════════════════════════════════
   SCROLL ANIMATIONS
   ═══════════════════════════════════════════════════════════════ */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
}


/* ═══════════════════════════════════════════════════════════════
   NAVBAR SCROLL EFFECT
   ═══════════════════════════════════════════════════════════════ */
function initNavbarScroll() {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}


/* ═══════════════════════════════════════════════════════════════
   MOBILE MENU
   ═══════════════════════════════════════════════════════════════ */
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('hamburgerBtn');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
}


/* ═══════════════════════════════════════════════════════════════
   ADMIN PANEL
   ═══════════════════════════════════════════════════════════════ */
const ADMIN_HASH = 'e038d6249bea56b54208e1235040122e85d76a84d53033268c5e22e43d11628d';

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function initAdmin() {
  const hash = window.location.hash;
  if (!hash.startsWith('#admin')) return;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const isLoggedIn = Storage.get('admin_logged_in');

  if (isLoggedIn) {
    showAdminDashboard();
  } else {
    showAdminLogin();
  }
}

function showAdminLogin() {
  const pageEl = document.getElementById('page-home');
  pageEl.classList.add('active');

  // Criar conteúdo de login inline
  const hero = pageEl.querySelector('.hero');
  hero.innerHTML = `
    <div class="admin-login">
      <div class="admin-login-card">
        <div class="admin-login-icon">🔐</div>
        <h2 class="admin-login-title">${i18n[currentLang].admin_login_title}</h2>
        <p class="admin-login-text">${i18n[currentLang].admin_login_text}</p>
        <input type="password" class="admin-input" id="adminPasswordInput"
               placeholder="${i18n[currentLang].admin_password}"
               onkeypress="if(event.key==='Enter') attemptAdminLogin()"
               data-tooltip="${i18n[currentLang].tooltip_enter_password}">
        <div class="admin-error" id="adminError">${i18n[currentLang].admin_login_error}</div>
         <button class="btn btn-primary" onclick="attemptAdminLogin()" data-tooltip="${i18n[currentLang].tooltip_enter_admin}">${i18n[currentLang].admin_login_btn}</button>
        <div class="mt-3">
           <a href="#home" class="btn btn-ghost" data-tooltip="${i18n[currentLang].tooltip_back_home}">${i18n[currentLang].back}</a>
        </div>
      </div>
    </div>
  `;
}

async function attemptAdminLogin() {
  const input = document.getElementById('adminPasswordInput');
  const error = document.getElementById('adminError');

  const hashedInput = await hashPassword(input.value);
  if (hashedInput === ADMIN_HASH) {
    Storage.set('admin_logged_in', true);
    showAdminDashboard();
  } else {
    error.classList.add('visible');
    input.value = '';
    input.style.borderColor = '#e74c3c';
    setTimeout(() => {
      input.style.borderColor = '';
      error.classList.remove('visible');
    }, 2000);
  }
}

function showAdminDashboard() {
  const pageHome = document.getElementById('page-home');
  pageHome.classList.remove('active');

  let adminPage = document.getElementById('page-admin');
  if (!adminPage) {
    adminPage = document.createElement('div');
    adminPage.id = 'page-admin';
    adminPage.className = 'page';
    document.body.appendChild(adminPage);
  }
  adminPage.classList.add('active');

  const allVotes = Storage.get('all_votes') || [];
  const votesBySong = {};
  const votesByStyle = {};

  allVotes.forEach(v => {
    votesBySong[v.songId] = (votesBySong[v.songId] || 0) + 1;
    const song = getSongById(v.songId);
    if (song) votesByStyle[song.style] = (votesByStyle[song.style] || 0) + 1;
  });

  const totalVotes = allVotes.length;
  const votingOpen = isVotingOpen();
  const L = i18n[currentLang];

  adminPage.innerHTML = `
    <div class="admin-dashboard">
      <div class="admin-header">
        <h1 class="admin-title">🔐 ${L.admin_title}</h1>
        <div class="admin-actions">
          <button class="btn btn-secondary btn-sm" onclick="exportCSV()">📊 ${L.admin_export_csv}</button>
          <button class="btn btn-secondary btn-sm" onclick="exportJSON()">📄 ${L.admin_export_json}</button>
          <button class="btn btn-secondary btn-sm" onclick="resetVotes()" style="color:#e74c3c;">🗑️ ${L.admin_reset}</button>
          <button class="btn btn-ghost btn-sm" onclick="adminLogout()">${L.admin_logout}</button>
        </div>
      </div>

      <!-- Admin Tabs -->
      <div class="admin-tabs">
        <button class="admin-tab active" onclick="switchAdminTab('ranking', this)">📊 ${L.admin_ranking}</button>
        <button class="admin-tab" onclick="switchAdminTab('songs', this)">🎵 ${L.admin_manage_songs}</button>
        <button class="admin-tab" onclick="switchAdminTab('requests', this)">📩 Pedidos</button>
        <button class="admin-tab" onclick="switchAdminTab('subscribers', this)">👥 Subscritores</button>
      </div>

      <!-- Voting Status Toggle -->
      <div class="flex-between mb-3" style="padding:1rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);">
        <span style="font-weight:600;">${votingOpen ? L.voting_open : L.voting_closed}</span>
        <div class="admin-toggle ${votingOpen ? 'active' : ''}" onclick="toggleVotingStatus()"></div>
      </div>

      <!-- Tab: Ranking -->
      <div class="admin-tab-content active" id="admin-tab-ranking">
        <div class="admin-stats">
          <div class="admin-stat-card">
            <div class="admin-stat-number">${totalVotes}</div>
            <div class="admin-stat-label">${L.admin_total_votes}</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number">${songs.length}</div>
            <div class="admin-stat-label">${L.admin_total_songs}</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number">${Object.keys(votesBySong).length}</div>
            <div class="admin-stat-label">${L.admin_ranking}</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number">${votingOpen ? '🟢' : '🔴'}</div>
            <div class="admin-stat-label">${L.admin_voting}</div>
          </div>
          <div class="admin-stat-card">
            <div class="admin-stat-number">${getTotalPlays()}</div>
            <div class="admin-stat-label">Reproduções</div>
          </div>
        </div>
        <h3 class="mb-2" style="font-size:0.8rem;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);">${L.admin_ranking}</h3>
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th></th>
                  <th>${L.admin_song}</th>
                  <th>Ano</th>
                  <th>${L.admin_votes}</th>
              </tr>
            </thead>
            <tbody>
              ${songs.map((song, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>
                    <div class="admin-table-cover">
                      <img src="${song.cover}" alt="${song.title}" loading="lazy"
                           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 36%22><rect fill=%22%231b1b1d%22 width=%2236%22 height=%2236%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2212%22>♪</text></svg>'">
                    </div>
                  </td>
                  <td style="font-weight:600;">${song.title}</td>
                  <td>${song.date ? new Date(song.date).getFullYear() : '—'}</td>
                  <td style="color:var(--gold);font-weight:700;">${votesBySong[song.id] || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab: Manage Songs -->
      <div class="admin-tab-content" id="admin-tab-songs">
        <div class="admin-songs-toolbar">
          <button class="btn btn-primary btn-sm" onclick="adminShowAddSong()">➕ ${L.admin_add_song}</button>
          <button class="btn btn-secondary btn-sm" onclick="adminExportSongsJS()">💾 ${L.admin_export_songs_js}</button>
          <button class="btn btn-secondary btn-sm" onclick="adminImportJSON()">📥 ${L.admin_import_json}</button>
        </div>
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th></th>
                <th>${L.admin_song}</th>
                <th>Ano</th>
                <th>Estilo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${songs.map(song => `
                <tr>
                  <td>${song.id}</td>
                  <td>
                    <div class="admin-table-cover">
                      <img src="${song.cover}" alt="${song.title}" loading="lazy"
                           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 36%22><rect fill=%22%231b1b1d%22 width=%2236%22 height=%2236%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2212%22>♪</text></svg>'">
                    </div>
                  </td>
                  <td style="font-weight:600;">${song.title}</td>
                  <td>${song.date ? new Date(song.date).getFullYear() : '—'}</td>
                  <td>${song.style}</td>
                  <td class="admin-actions-cell">
                    <button class="btn btn-ghost btn-xs" onclick="adminEditSong(${song.id})">✏️</button>
                    <button class="btn btn-ghost btn-xs" onclick="adminDeleteSong(${song.id})" style="color:#e74c3c;">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab: Requests -->
      <div class="admin-tab-content" id="admin-tab-requests">
        ${renderAdminRequests()}
      </div>

      <!-- Tab: Subscribers -->
      <div class="admin-tab-content" id="admin-tab-subscribers">
        ${renderAdminSubscribers()}
      </div>

      <!-- Song Form (hidden by default) -->
      <div class="admin-song-form-overlay" id="adminSongFormOverlay" style="display:none;">
        <div class="admin-song-form" id="adminSongForm">
          <h3 id="adminSongFormTitle">${L.admin_add_song}</h3>
          <form onsubmit="adminSaveSong(event)">
            <input type="hidden" id="adminSongId">
            <div class="admin-form-grid">
              <div class="admin-form-group">
                <label>${L.admin_field_title} *</label>
                <input type="text" id="adminSongTitle" required>
              </div>
              <div class="admin-form-group">
                <label>${L.admin_field_artist} *</label>
                <input type="text" id="adminSongArtist" value="PROFEF">
              </div>
              <div class="admin-form-group">
                <label>${L.admin_field_date || 'Data de Lançamento'}</label>
                <input type="date" id="adminSongDate">
              </div>
              <div class="admin-form-group">
                <label>${L.admin_field_style} *</label>
                <input type="text" id="adminSongStyle" required>
              </div>
              <div class="admin-form-group">
                <label>${L.admin_field_mood} *</label>
                <input type="text" id="adminSongMood" required>
              </div>
              <div class="admin-form-group">
                <label>${L.admin_field_youtube}</label>
                <input type="url" id="adminSongYoutube" placeholder="https://youtu.be/...">
              </div>
              <div class="admin-form-group">
                <label>${L.admin_field_cover}</label>
                <input type="text" id="adminSongCover" placeholder="assets/covers/filename.png">
              </div>
              <div class="admin-form-group">
                <label>${L.admin_field_lyrics_lang}</label>
                <select id="adminSongLyricsLang">
                  <option value="en">Inglês</option>
                  <option value="spanish">Espanhol</option>
                  <option value="italian">Italiano</option>
                  <option value="french">Francês</option>
                </select>
              </div>
            </div>
            <div class="admin-form-group">
              <label>${L.admin_field_description}</label>
              <textarea id="adminSongDescPT" rows="3"></textarea>
            </div>
            <div class="admin-form-group">
              <label>${L.admin_field_description_en}</label>
              <textarea id="adminSongDescEN" rows="3"></textarea>
            </div>
            <div class="admin-form-group">
              <label>${L.admin_field_description_es}</label>
              <textarea id="adminSongDescES" rows="3"></textarea>
            </div>
            <div class="admin-form-group">
              <label>${L.admin_field_description_fr}</label>
              <textarea id="adminSongDescFR" rows="3"></textarea>
            </div>
            <div class="admin-form-group">
              <label>${L.admin_field_description_it}</label>
              <textarea id="adminSongDescIT" rows="3"></textarea>
            </div>
            <div class="admin-form-group">
              <label>${L.admin_field_lyrics}</label>
              <textarea id="adminSongLyrics" rows="8" placeholder="English lyrics..."></textarea>
            </div>
            <div class="admin-form-group">
              <label>${L.admin_field_lyrics_pt}</label>
              <textarea id="adminSongLyricsPT" rows="8" placeholder="Letra em português..."></textarea>
            </div>
            <div class="admin-form-actions">
              <button type="submit" class="btn btn-primary">${L.admin_save_song}</button>
              <button type="button" class="btn btn-ghost" onclick="adminCloseSongForm()">${L.admin_cancel}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function adminLogout() {
  Storage.remove('admin_logged_in');
  window.location.hash = '#home';
  navigateTo('home');
  location.reload();
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('admin-tab-' + tab).classList.add('active');
}

function adminShowAddSong() {
  document.getElementById('adminSongId').value = '';
  document.getElementById('adminSongTitle').value = '';
  document.getElementById('adminSongArtist').value = 'PROFEF';
  document.getElementById('adminSongDate').value = '';
  document.getElementById('adminSongStyle').value = '';
  document.getElementById('adminSongMood').value = '';
  document.getElementById('adminSongYoutube').value = '';
  document.getElementById('adminSongCover').value = '';
  document.getElementById('adminSongLyricsLang').value = 'en';
  document.getElementById('adminSongDescPT').value = '';
  document.getElementById('adminSongDescEN').value = '';
  document.getElementById('adminSongDescES').value = '';
  document.getElementById('adminSongDescFR').value = '';
  document.getElementById('adminSongDescIT').value = '';
  document.getElementById('adminSongLyrics').value = '';
  document.getElementById('adminSongLyricsPT').value = '';
  document.getElementById('adminSongFormTitle').textContent = i18n[currentLang].admin_add_song;
  document.getElementById('adminSongFormOverlay').style.display = 'flex';
}

function adminEditSong(id) {
  const song = getSongById(id);
  if (!song) return;
  document.getElementById('adminSongId').value = song.id;
  document.getElementById('adminSongTitle').value = song.title;
  document.getElementById('adminSongArtist').value = song.artist;
  document.getElementById('adminSongDate').value = song.date || '';
  document.getElementById('adminSongStyle').value = song.style;
  document.getElementById('adminSongMood').value = song.mood;
  document.getElementById('adminSongYoutube').value = song.youtube || '';
  document.getElementById('adminSongCover').value = song.cover || '';
  document.getElementById('adminSongLyricsLang').value = song.lyrics_lang || 'en';
  document.getElementById('adminSongDescPT').value = song.description || '';
  document.getElementById('adminSongDescEN').value = song.description_en || '';
  document.getElementById('adminSongDescES').value = song.description_es || '';
  document.getElementById('adminSongDescFR').value = song.description_fr || '';
  document.getElementById('adminSongDescIT').value = song.description_it || '';
  document.getElementById('adminSongLyrics').value = song.lyrics || '';
  document.getElementById('adminSongLyricsPT').value = song.lyrics_pt || '';
  document.getElementById('adminSongFormTitle').textContent = i18n[currentLang].admin_edit_song + ': ' + song.title;
  document.getElementById('adminSongFormOverlay').style.display = 'flex';
}

function adminCloseSongForm() {
  document.getElementById('adminSongFormOverlay').style.display = 'none';
}

/**
 * Limpar caminho da capa — remover caminhos Windows e aspas extras
 */
function sanitizeCoverPath(coverInput, title) {
  if (!coverInput) {
    return 'assets/covers/' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
  }
  let path = coverInput.replace(/['"]/g, '').trim();
  path = path.replace(/^.*[\\\/]assets[\\\/]covers[\\\/]/i, 'assets/covers/');
  path = path.replace(/^.*[\\\/]([^\\\/]+\.png)$/i, '$1');
  path = path.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '')
    .replace(/--+/g, '-');
  if (!path.startsWith('assets/covers/')) {
    path = 'assets/covers/' + path;
  }
  return path;
}

function adminSaveSong(e) {
  e.preventDefault();
  const L = i18n[currentLang];
  const id = document.getElementById('adminSongId').value;
  const dateVal = document.getElementById('adminSongDate').value;
  const data = {
    title: document.getElementById('adminSongTitle').value.trim(),
    artist: document.getElementById('adminSongArtist').value.trim(),
    date: dateVal || '',
    style: document.getElementById('adminSongStyle').value.trim(),
    mood: document.getElementById('adminSongMood').value.trim(),
    youtube: document.getElementById('adminSongYoutube').value.trim(),
    cover: sanitizeCoverPath(document.getElementById('adminSongCover').value.trim(), document.getElementById('adminSongTitle').value.trim()),
    audio: '',
    lyrics_lang: document.getElementById('adminSongLyricsLang').value,
    description: document.getElementById('adminSongDescPT').value.trim(),
    description_en: document.getElementById('adminSongDescEN').value.trim(),
    description_es: document.getElementById('adminSongDescES').value.trim(),
    description_fr: document.getElementById('adminSongDescFR').value.trim(),
    description_it: document.getElementById('adminSongDescIT').value.trim(),
    lyrics: document.getElementById('adminSongLyrics').value.trim(),
    lyrics_pt: document.getElementById('adminSongLyricsPT').value.trim()
  };

  if (id) {
    SongManager.edit(parseInt(id), data);
    alert(L.admin_song_edited);
  } else {
    SongManager.add(data);
    alert(L.admin_song_added);
  }

  adminCloseSongForm();
  showAdminDashboard();
}

function adminDeleteSong(id) {
  const L = i18n[currentLang];
  const song = getSongById(id);
  if (!song) return;
  if (!confirm(L.admin_confirm_delete + '\n\n' + song.title)) return;
  SongManager.remove(id);
  alert(L.admin_song_deleted);
  showAdminDashboard();
}

function adminExportSongsJS() {
  const content = SongManager.exportSongsJS();
  downloadFile(content, 'songs.js', 'application/javascript');
}

function adminImportJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (SongManager.importJSON(ev.target.result)) {
        alert('Importado com sucesso! Total: ' + songs.length + ' músicas.');
        showAdminDashboard();
      } else {
        alert('Erro ao importar. Verifique o ficheiro JSON.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function toggleVotingStatus() {
  const current = isVotingOpen();
  Storage.set('voting_status', current ? 'closed' : 'open');
  showAdminDashboard();
}

function resetVotes() {
  if (confirm(i18n[currentLang].admin_confirm_reset)) {
    Storage.remove('votes');
    Storage.remove('all_votes');
    showAdminDashboard();
  }
}

function exportCSV() {
  const allVotes = Storage.get('all_votes') || [];
  let csv = 'Song ID,Song Title,Date,Position,Context,Timestamp\n';

  allVotes.forEach(v => {
    const song = getSongById(v.songId);
    if (song) {
      csv += `${v.songId},"${song.title}",${song.date || ''},${v.position},${v.context},${new Date(v.timestamp).toISOString()}\n`;
    }
  });

  downloadFile(csv, 'profef_votes.csv', 'text/csv');
}

function exportJSON() {
  const allVotes = Storage.get('all_votes') || [];
  const data = allVotes.map(v => {
    const song = getSongById(v.songId);
    return {
      songId: v.songId,
      title: song ? song.title : 'Unknown',
      date: song ? song.date : '',
      position: v.position,
      context: v.context,
      timestamp: new Date(v.timestamp).toISOString()
    };
  });

  downloadFile(JSON.stringify(data, null, 2), 'profef_votes.json', 'application/json');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


/* ═══════════════════════════════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════════ */
function hideLoadingScreen() {
  const bar = document.getElementById('loadingBar');
  let progress = 0;

  const interval = setInterval(() => {
    progress += Math.random() * 30;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
      }, 300);
    }
    bar.style.width = progress + '%';
  }, 150);
}


/* ═══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════ */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // ESC fecha search e modal
    if (e.key === 'Escape') {
      document.getElementById('searchOverlay').classList.remove('open');
      document.getElementById('confirmModal').classList.remove('open');
    }

    // Ctrl+K abre search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggleSearch();
    }
  });
}


/* ═══════════════════════════════════════════════════════════════
   YOUTUBE PREVIEW — Hover visual + open in new tab
   ═══════════════════════════════════════════════════════════════ */

/**
 * Extrair ID de vídeo YouTube de um URL
 * Suporta: watch?v=ID, youtu.be/ID, embed/ID, shorts/ID
 */
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Abrir vídeo YouTube numa nova aba
 */
function openYouTube(songId) {
  const song = getSongById(songId);
  if (!song || !song.youtube) return;
  window.open(song.youtube, '_blank', 'noopener');
}

/**
 * Eventos de hover nos song cards — indicador visual
 */
function setupAudioHover() {
  document.addEventListener('mouseenter', (e) => {
    const target = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    if (!target) return;
    const card = target.closest('.song-card');
    if (!card) return;
    const songId = parseInt(card.dataset.songId);
    if (!songId) return;

    // Indicador visual
    if (!card.querySelector('.audio-indicator')) {
      const indicator = document.createElement('div');
      indicator.className = 'audio-indicator';
      indicator.innerHTML = `
        <div class="audio-bars">
          <span></span><span></span><span></span><span></span>
        </div>
      `;
      card.appendChild(indicator);
    }
    card.classList.add('audio-playing');

  }, true);

  document.addEventListener('mouseleave', (e) => {
    const target = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    if (!target) return;
    const card = target.closest('.song-card');
    if (!card) return;

    setTimeout(() => {
      card.classList.remove('audio-playing');
      const indicator = card.querySelector('.audio-indicator');
      if (indicator) indicator.remove();
    }, 200);

  }, true);
}


/* ═══════════════════════════════════════════════════════════════
   SUBSCRIBER SYSTEM
   ═══════════════════════════════════════════════════════════════ */

/**
 * Obter subscritores
 */
function getSubscribers() {
  return Storage.get('subscribers') || [];
}

/**
 * Obter subscritor atual (logado)
 */
function getCurrentSubscriber() {
  return Storage.get('current_subscriber') || null;
}

/**
 * Guardar subscritor atual
 */
function setCurrentSubscriber(sub) {
  Storage.set('current_subscriber', sub);
}

/**
 * Verificar se é subscritor
 */
function isSubscriber() {
  return getCurrentSubscriber() !== null;
}

/**
 * Atualizar perfil do subscritor
 */
async function subscriberUpdateProfile() {
  const sub = getCurrentSubscriber();
  if (!sub) return;

  const name = document.getElementById('subEditName').value.trim();
  const email = document.getElementById('subEditEmail').value.trim().toLowerCase();
  const password = document.getElementById('subEditPassword').value;
  const errorEl = document.getElementById('subEditError');
  const L = i18n[currentLang];

  if (!name || !email) {
    errorEl.textContent = L.sub_edit_error_fields;
    errorEl.style.display = 'block';
    return;
  }

  if (password && password.length < 6) {
    errorEl.textContent = L.sub_edit_error_password;
    errorEl.style.display = 'block';
    return;
  }

  const subscribers = getSubscribers();
  const fullSub = subscribers.find(s => s.id === sub.id);
  if (!fullSub) return;

  // Check email uniqueness
  if (email !== sub.email && subscribers.find(s => s.email === email)) {
    errorEl.textContent = L.sub_edit_error_fields;
    errorEl.style.display = 'block';
    return;
  }

  // Update name
  fullSub.name = name;

  // Update email
  if (email !== sub.email) {
    fullSub.email = email;
  }

  // Update password if provided
  if (password) {
    fullSub.password = await hashPassword(password);
  }

  saveSubscribers(subscribers);

  // Update current subscriber session
  setCurrentSubscriber({ id: fullSub.id, name: fullSub.name, email: fullSub.email });
  renderSubscriberNav();

  errorEl.style.display = 'none';
  alert(L.sub_edit_success);
  showSubView('profile');
}

/**
 * Confirmar eliminação de conta
 */
function confirmDeleteAccount() {
  const L = i18n[currentLang];
  if (confirm(L.sub_edit_confirm_delete)) {
    deleteSubscriberAccount();
  }
}

/**
 * Eliminar conta do subscritor
 */
function deleteSubscriberAccount() {
  const sub = getCurrentSubscriber();
  if (!sub) return;

  const subscribers = getSubscribers();
  const filtered = subscribers.filter(s => s.id !== sub.id);
  saveSubscribers(filtered);

  // Clean up user data
  Storage.remove('current_subscriber');

  renderSubscriberNav();
  closeSubscriberModal();
}

/**
 * Renderizar botão de subscritor na navbar
 */
function renderSubscriberNav() {
  const container = document.getElementById('subscriberNav');
  if (!container) return;

  const sub = getCurrentSubscriber();
  if (sub) {
    const initial = sub.name.charAt(0).toUpperCase();
    container.innerHTML = `
      <button class="subscriber-btn logged-in" onclick="openSubscriberModal()" data-tooltip="${i18n[currentLang].sub_my_profile}">
        <span class="subscriber-avatar-small">${initial}</span>
        <span>${sub.name}</span>
      </button>
    `;
  } else {
    container.innerHTML = `
      <button class="subscriber-btn" onclick="openSubscriberModal()" data-tooltip="${i18n[currentLang].sub_login_tooltip}">
        👤 <span data-i18n="sub_enter">Entrar</span>
      </button>
    `;
  }
}

/**
 * Abrir modal de subscritor
 */
function openSubscriberModal() {
  const modal = document.getElementById('subscriberModal');
  if (!modal) return;
  modal.classList.add('open');

  const sub = getCurrentSubscriber();
  if (sub) {
    showSubView('profile');
  } else {
    showSubView('login');
  }
}

/**
 * Fechar modal de subscritor
 */
function closeSubscriberModal() {
  const modal = document.getElementById('subscriberModal');
  if (modal) modal.classList.remove('open');
}

/**
 * Mostrar vista do modal (login/register/profile)
 */
function showSubView(view) {
  document.getElementById('subLoginView').style.display = view === 'login' ? '' : 'none';
  document.getElementById('subRegisterView').style.display = view === 'register' ? '' : 'none';
  document.getElementById('subProfileView').style.display = view === 'profile' ? '' : 'none';
  document.getElementById('subEditView').style.display = view === 'edit' ? '' : 'none';

  if (view === 'profile') {
    renderSubscriberProfile();
  }

  if (view === 'edit') {
    const sub = getCurrentSubscriber();
    if (sub) {
      document.getElementById('subEditName').value = sub.name;
      document.getElementById('subEditEmail').value = sub.email;
      document.getElementById('subEditPassword').value = '';
      document.getElementById('subEditError').style.display = 'none';
    }
  }
}

/**
 * Registar subscritor
 */
async function subscriberRegister() {
  const name = document.getElementById('subRegName').value.trim();
  const email = document.getElementById('subRegEmail').value.trim().toLowerCase();
  const password = document.getElementById('subRegPassword').value;
  const errorEl = document.getElementById('subRegError');

  if (!name || !email || !password) {
    errorEl.textContent = i18n[currentLang].sub_error_fields;
    errorEl.style.display = 'block';
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = i18n[currentLang].sub_error_password;
    errorEl.style.display = 'block';
    return;
  }

  const subscribers = getSubscribers();
  if (subscribers.find(s => s.email === email)) {
    errorEl.textContent = i18n[currentLang].sub_error_exists;
    errorEl.style.display = 'block';
    return;
  }

  const hashedPw = await hashPassword(password);
  const newSub = {
    id: Date.now(),
    name: name,
    email: email,
    password: hashedPw,
    joinedAt: new Date().toISOString(),
    favoriteSongs: [],
    songRequests: []
  };

  subscribers.push(newSub);
  saveSubscribers(subscribers);

  setCurrentSubscriber({ id: newSub.id, name: newSub.name, email: newSub.email });
  renderSubscriberNav();
  showSubView('profile');
  errorEl.style.display = 'none';
}

/**
 * Login de subscritor
 */
async function subscriberLogin() {
  const email = document.getElementById('subLoginEmail').value.trim().toLowerCase();
  const password = document.getElementById('subLoginPassword').value;
  const errorEl = document.getElementById('subLoginError');

  if (!email || !password) {
    errorEl.textContent = i18n[currentLang].sub_error_fields;
    errorEl.style.display = 'block';
    return;
  }

  const subscribers = getSubscribers();
  const hashedPw = await hashPassword(password);
  const sub = subscribers.find(s => s.email === email && s.password === hashedPw);

  if (!sub) {
    errorEl.textContent = i18n[currentLang].sub_error_invalid;
    errorEl.style.display = 'block';
    return;
  }

  setCurrentSubscriber({ id: sub.id, name: sub.name, email: sub.email });
  renderSubscriberNav();
  showSubView('profile');
  errorEl.style.display = 'none';
}

/**
 * Logout de subscritor
 */
function subscriberLogout() {
  Storage.remove('current_subscriber');
  renderSubscriberNav();
  closeSubscriberModal();
}

/**
 * Renderizar perfil do subscritor
 */
function renderSubscriberProfile() {
  const sub = getCurrentSubscriber();
  if (!sub) return;

  const initial = sub.name.charAt(0).toUpperCase();
  document.getElementById('subProfileAvatar').textContent = initial;
  document.getElementById('subProfileName').textContent = sub.name;
  document.getElementById('subProfileEmail').textContent = sub.email;

  const favs = getFavorites().length;
  const reqs = getSongRequests().filter(r => r.email === sub.email).length;
  const votes = Object.values(Storage.get('votes') || {}).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

  document.getElementById('subProfileStats').innerHTML = `
    <div style="text-align:center;padding:0.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);">
      <div style="font-size:1.2rem;font-weight:700;color:var(--gold);">${favs}</div>
      <div style="font-size:0.7rem;color:var(--text-dim);">${i18n[currentLang].sub_stat_favorites}</div>
    </div>
    <div style="text-align:center;padding:0.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);">
      <div style="font-size:1.2rem;font-weight:700;color:var(--gold);">${reqs}</div>
      <div style="font-size:0.7rem;color:var(--text-dim);">${i18n[currentLang].sub_stat_requests}</div>
    </div>
    <div style="text-align:center;padding:0.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);">
      <div style="font-size:1.2rem;font-weight:700;color:var(--gold);">${votes}</div>
      <div style="font-size:0.7rem;color:var(--text-dim);">${i18n[currentLang].sub_stat_votes}</div>
    </div>
  `;
}

/**
 * Verificar se a funcionalidade requer subscritor
 */
/**
 * Guardar subscritores
 */
function saveSubscribers(subs) {
  Storage.set('subscribers', subs);
}

/**
 * Renderizar subscritores no admin
 */
function renderAdminSubscribers() {
  const subscribers = getSubscribers();
  if (subscribers.length === 0) return '';

  return `
    <div class="admin-requests-section">
      <h3 class="mb-2" style="font-size:0.8rem;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);">${i18n[currentLang].admin_subscribers} (${subscribers.length})</h3>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>${i18n[currentLang].sub_name_label}</th>
              <th>${i18n[currentLang].sub_email_label}</th>
              <th>${i18n[currentLang].sub_joined}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${subscribers.map((sub, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td style="font-weight:600;">${sub.name}</td>
                <td>${sub.email}</td>
                <td>${new Date(sub.joinedAt).toLocaleDateString('pt-PT')}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="deleteSubscriber(${sub.id})" style="color:#e74c3c;">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Eliminar subscritor
 */
function deleteSubscriber(id) {
  if (!confirm(i18n[currentLang].admin_confirm_reset)) return;
  let subs = getSubscribers();
  subs = subs.filter(s => s.id !== id);
  saveSubscribers(subs);
  showAdminDashboard();
}


/* ═══════════════════════════════════════════════════════════════
   SONG REQUESTS SYSTEM
   ═══════════════════════════════════════════════════════════════ */

/**
 * Obter todos os pedidos
 */
function getSongRequests() {
  return Storage.get('song_requests') || [];
}

/**
 * Guardar pedidos
 */
function saveSongRequests(requests) {
  Storage.set('song_requests', requests);
}

/**
 * Submeter novo pedido
 */
function submitSongRequest(e) {
  e.preventDefault();

  if (!isSubscriber()) {
    openSubscriberModal();
    return;
  }

  const name = document.getElementById('reqName').value.trim();
  const title = document.getElementById('reqSongTitle').value.trim();
  const theme = document.getElementById('reqTheme').value.trim();
  const style = document.getElementById('reqStyle').value;
  const mood = document.getElementById('reqMood').value;
  const email = document.getElementById('reqEmail').value.trim();

  if (!name || !title || !theme) return;

  const requests = getSongRequests();
  requests.push({
    id: Date.now(),
    name: name,
    title: title,
    theme: theme,
    style: style || '',
    mood: mood || '',
    email: email || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  saveSongRequests(requests);

  document.getElementById('requestForm').style.display = 'none';
  document.getElementById('requestSuccess').style.display = 'block';
}

/**
 * Reset form de pedidos
 */
function resetRequestForm() {
  document.getElementById('requestForm').reset();
  document.getElementById('requestForm').style.display = '';
  document.getElementById('requestSuccess').style.display = 'none';
}

/**
 * Renderizar página de estilos
 */
function renderStylesPage() {
  const gridView = document.getElementById('stylesGridView');
  const detailView = document.getElementById('styleDetailView');
  if (!gridView) return;

  gridView.style.display = '';
  if (detailView) detailView.style.display = 'none';

  const categories = [
    {
      name: 'Americanas',
      icon: '🇺🇸',
      subStyles: ['Soul', 'Blues', 'Country', 'Reggae', 'Gospel', 'Pop', 'Rock']
    },
    { name: 'Portuguesas', icon: '🇵🇹', subStyles: ['Fado'] },
    { name: 'Brasileiras', icon: '🇧🇷', subStyles: ['Folk'] },
    { name: 'Latinas', icon: '🌎', subStyles: ['Latin', 'Tropical'] },
    { name: 'Italianas', icon: '🇮🇹', subStyles: [] },
    { name: 'Francesas', icon: '🇫🇷', subStyles: [] }
  ];

  gridView.innerHTML = categories.map(cat => {
    const count = songs.filter(s => cat.subStyles.includes(s.style)).length;
    const covers = songs.filter(s => cat.subStyles.includes(s.style)).slice(0, 3).map(s =>
      `<img src="${s.cover}" alt="${s.title}" loading="lazy" onerror="this.style.display='none'">`
    ).join('');
    const more = count > 3 ? `<div class="style-card-more">+${count - 3}</div>` : '';

    return `
      <div class="style-card" onclick="showStyleDetail('${cat.name}')">
        <span class="style-card-icon">${cat.icon}</span>
        <div class="style-card-name">${cat.name}</div>
        <div class="style-card-count">${count} ${i18n[currentLang].styles_songs}</div>
        <div class="style-card-covers">${covers}</div>
        ${more}
      </div>
    `;
  }).join('');
}

/**
 * Mostrar detalhe de um estilo
 */
function showStyleDetail(categoryName) {
  const gridView = document.getElementById('stylesGridView');
  const detailView = document.getElementById('styleDetailView');
  const title = document.getElementById('styleDetailTitle');
  const count = document.getElementById('styleDetailCount');
  const songsContainer = document.getElementById('styleDetailSongs');
  if (!detailView) return;

  const categories = {
    'Americanas': ['Soul', 'Blues', 'Country', 'Reggae', 'Gospel', 'Pop', 'Rock'],
    'Portuguesas': ['Fado'],
    'Brasileiras': ['Folk'],
    'Latinas': ['Latin', 'Tropical'],
    'Italianas': [],
    'Francesas': []
  };

  const icons = { 'Americanas': '🇺🇸', 'Portuguesas': '🇵🇹', 'Brasileiras': '🇧🇷', 'Latinas': '🌎', 'Italianas': '🇮🇹', 'Francesas': '🇫🇷' };

  const subStyles = categories[categoryName] || [];
  const styleSongs = songs.filter(s => subStyles.includes(s.style));

  gridView.style.display = 'none';
  detailView.style.display = 'block';

  title.textContent = `${icons[categoryName] || ''} ${categoryName}`;
  count.textContent = `${styleSongs.length} ${i18n[currentLang].styles_songs}`;

  if (categoryName === 'Americanas') {
    const subGroups = {
      'Soul / Blues': styleSongs.filter(s => ['Soul', 'Blues'].includes(s.style)),
      'Country': styleSongs.filter(s => s.style === 'Country'),
      'Reggae': styleSongs.filter(s => s.style === 'Reggae'),
      'Gospel': styleSongs.filter(s => s.style === 'Gospel'),
      'Pop / Rock': styleSongs.filter(s => ['Pop', 'Rock'].includes(s.style))
    };

    const subIcons = { 'Soul / Blues': '💫', 'Country': '🤠', 'Reggae': '🏝️', 'Gospel': '🙏', 'Pop / Rock': '🎤' };

    songsContainer.innerHTML = Object.keys(subGroups).filter(k => subGroups[k].length > 0).map(style => `
      <div style="grid-column:1/-1;margin-bottom:0.5rem;">
        <h3 style="font-size:0.8rem;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);margin-bottom:1rem;">${subIcons[style] || '🎵'} ${style} (${subGroups[style].length})</h3>
        <div class="songs-grid" style="margin-top:0;">
          ${subGroups[style].map(song => createSongCard(song, { showFav: true })).join('')}
        </div>
      </div>
    `).join('');
  } else {
    if (styleSongs.length === 0) {
      songsContainer.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;">
          <div style="font-size:2.5rem;margin-bottom:1rem;">🎵</div>
          <p style="color:var(--text-dim);">${i18n[currentLang].styles_no_songs}</p>
        </div>
      `;
    } else {
      songsContainer.innerHTML = styleSongs.map(song =>
        createSongCard(song, { showFav: true })
      ).join('');
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Voltar à grelha de estilos
 */
function backToStylesGrid() {
  navigateTo('styles');
}




/**
 * Renderizar página de pedidos
 */
function renderRequestsPage() {
  const requests = getSongRequests();
  const completed = requests.filter(r => r.status === 'completed');
  const container = document.getElementById('completedRequestsContainer');
  if (!container) return;

  if (completed.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="section-badge" data-i18n="req_completed_badge">CRIADOS</div>
    <h3 class="section-title" style="font-size:1.3rem;" data-i18n="req_completed_title">Músicas Criadas a partir de Pedidos</h3>
    <div class="songs-grid" style="margin-top:1.5rem;">
      ${completed.map(req => {
        const song = songs.find(s => s.title.toLowerCase() === req.title.toLowerCase());
        if (song) {
          return `<div class="song-card" onclick="navigateTo('song', ${song.id})" style="cursor:pointer;">
            <div class="song-card-cover">
              <img src="${song.cover}" alt="${song.title}" loading="lazy" draggable="false" class="no-download"
                   onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%231b1b1d%22 width=%22200%22 height=%22200%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2240%22>♪</text></svg>'">
            </div>
            <div class="song-card-title">${song.title}</div>
            <div class="song-card-artist">${i18n[currentLang].req_pedido_de} ${req.name}</div>
          </div>`;
        }
        return `<div class="request-card">
          <div class="request-card-header">
            <div class="request-card-title">${req.title}</div>
            <div class="request-card-status completed">${i18n[currentLang].req_status_completed}</div>
          </div>
          <div class="request-card-meta">${i18n[currentLang].req_pedido_de} ${req.name}</div>
          <div class="request-card-theme">${req.theme}</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

/**
 * Renderizar secção de pedidos no admin
 */
function renderAdminRequests() {
  const requests = getSongRequests();
  if (requests.length === 0) return '';

  const statusLabels = {
    pending: i18n[currentLang].req_status_pending,
    approved: i18n[currentLang].req_status_approved,
    rejected: i18n[currentLang].req_status_rejected,
    completed: i18n[currentLang].req_status_completed
  };

  return `
    <div class="admin-requests-section">
      <h3 class="mb-2" style="font-size:0.8rem;letter-spacing:2px;text-transform:uppercase;color:var(--text-dim);">${i18n[currentLang].admin_requests} (${requests.length})</h3>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>${i18n[currentLang].req_title_label}</th>
              <th>${i18n[currentLang].req_name_label}</th>
              <th>${i18n[currentLang].req_theme_label}</th>
              <th>${i18n[currentLang].admin_votes}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${requests.map((req, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td style="font-weight:600;">${req.title}</td>
                <td>${req.name}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${req.theme}</td>
                <td><span class="request-card-status ${req.status}">${statusLabels[req.status] || req.status}</span></td>
                <td>
                  <div class="request-actions">
                    ${req.status === 'pending' ? `
                      <button class="btn btn-ghost btn-sm" onclick="updateRequestStatus(${req.id}, 'approved')" style="color:#2ecc71;">✓</button>
                      <button class="btn btn-ghost btn-sm" onclick="updateRequestStatus(${req.id}, 'rejected')" style="color:#e74c3c;">✕</button>
                    ` : ''}
                    ${req.status === 'approved' ? `
                      <button class="btn btn-ghost btn-sm" onclick="updateRequestStatus(${req.id}, 'completed')" style="color:#D4AF37;">🎵</button>
                    ` : ''}
                    <button class="btn btn-ghost btn-sm" onclick="deleteRequest(${req.id})" style="color:#e74c3c;">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Atualizar estado de um pedido
 */
function updateRequestStatus(id, status) {
  const requests = getSongRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx > -1) {
    requests[idx].status = status;
    saveSongRequests(requests);
    showAdminDashboard();
  }
}

/**
 * Eliminar pedido
 */
function deleteRequest(id) {
  if (!confirm(i18n[currentLang].admin_confirm_reset)) return;
  let requests = getSongRequests();
  requests = requests.filter(r => r.id !== id);
  saveSongRequests(requests);
  showAdminDashboard();
}


/* ═══════════════════════════════════════════════════════════════
   BACK TO TOP + COOKIE CONSENT + SONG OF THE DAY + GALLERY
   ═══════════════════════════════════════════════════════════════ */

/**
 * Botão voltar ao topo — mostrar/esconder com scroll
 */
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
}

/**
 * Cookie consent banner
 */
function initCookieConsent() {
  if (Storage.get('cookies_consent')) return;
  const banner = document.getElementById('cookieConsent');
  if (banner) {
    setTimeout(() => banner.classList.add('visible'), 1500);
  }
}

function acceptCookies() {
  Storage.set('cookies_consent', true);
  const banner = document.getElementById('cookieConsent');
  if (banner) banner.classList.remove('visible');
}

function declineCookies() {
  Storage.set('cookies_consent', false);
  const banner = document.getElementById('cookieConsent');
  if (banner) banner.classList.remove('visible');
}

/**
 * Música do dia — escolhe uma música aleatória (consistente por dia)
 */
function getSongOfTheDay() {
  if (!songs || songs.length === 0) return null;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const idx = seed % songs.length;
  return songs[idx];
}

/**
 * Renderizar Política de Privacidade
 */
function renderPrivacyPolicy() {
  const container = document.getElementById('privacyContent');
  if (!container) return;
  const L = i18n[currentLang];
  const sections = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
  container.innerHTML = sections.map(s => `
    <div class="privacy-section">
      <h3>${L['privacy_' + s + '_title']}</h3>
      <p>${L['privacy_' + s + '_text']}</p>
    </div>
  `).join('');
}

/**
 * Renderizar secção de citações na home
 */
function renderQuotes() {
  const container = document.getElementById('quotesGrid');
  if (!container) return;

  const quotes = [
    {
      text_pt: 'Todas as grandes histórias merecem uma banda sonora.',
      text_en: 'Every great story deserves a soundtrack.',
      text_es: 'Toda gran historia merece una banda sonora.',
      text_fr: 'Toute grande histoire mérite une bande originale.',
      text_it: 'Ogni grande storia merita una colonna sonora.',
      author: 'PROFEF'
    },
    {
      text_pt: 'Uma boa música não é apenas aquela que se ouve... é aquela que fica connosco muito depois de terminar.',
      text_en: 'A good song is not just one you hear... it is one that stays with you long after it ends.',
      text_es: 'Una buena canción no es solo la que escuchas... es la que se queda contigo mucho después de terminar.',
      text_fr: 'Une bonne chanson n\'est pas seulement celle qu\'on entend... c\'est celle qui reste avec nous bien après qu\'elle soit terminée.',
      text_it: 'Una buona canzone non è solo quella che ascolti... è quella che rimane con te molto dopo che è finita.',
      author: 'PROFEF'
    },
    {
      text_pt: 'Cada música conta uma história.',
      text_en: 'Every song tells a story.',
      text_es: 'Cada canción cuenta una historia.',
      text_fr: 'Chaque chanson raconte une histoire.',
      text_it: 'Ogni canzone racconta una storia.',
      author: 'PROFEF'
    },
    {
      text_pt: 'Onde as palavras falham, a música fala.',
      text_en: 'Where words fail, music speaks.',
      text_es: 'Donde las palabras fallan, la música habla.',
      text_fr: 'Là où les mots échouent, la musique parle.',
      text_it: 'Dove le parole falliscono, la musica parla.',
      author: 'Hans Christian Andersen'
    },
    {
      text_pt: 'Sem música, a vida seria um erro.',
      text_en: 'Without music, life would be a mistake.',
      text_es: 'Sin música, la vida sería un error.',
      text_fr: 'Sans musique, la vie serait une erreur.',
      text_it: 'Senza musica, la vita sarebbe un errore.',
      author: 'Friedrich Nietzsche'
    },
    {
      text_pt: 'A música é a linguagem universal da humanidade.',
      text_en: 'Music is the universal language of mankind.',
      text_es: 'La música es el lenguaje universal de la humanidad.',
      text_fr: 'La musique est le langage universel de l\'humanité.',
      text_it: 'La musica è il linguaggio universale dell\'umanità.',
      author: 'Henry Wadsworth Longfellow'
    },
    {
      text_pt: 'Uma das melhores coisas da música é que, quando ela nos toca, não sentimos dor.',
      text_en: 'One good thing about music, when it hits you, you feel no pain.',
      text_es: 'Una buena cosa de la música es que, cuando te golpea, no sientes dolor.',
      text_fr: 'Une bonne chose avec la musique, quand elle vous touche, vous ne ressentez aucune douleur.',
      text_it: 'Una bella cosa della musica è che, quando ti colpisce, non senti dolore.',
      author: 'Bob Marley'
    },
    {
      text_pt: 'A música pode mudar o mundo porque pode mudar as pessoas.',
      text_en: 'Music can change the world because it can change people.',
      text_es: 'La música puede cambiar el mundo porque puede cambiar a las personas.',
      text_fr: 'La musique peut changer le monde parce qu\'elle peut changer les gens.',
      text_it: 'La musica può cambiare il mondo perché può cambiare le persone.',
      author: 'Bono'
    },
    {
      text_pt: 'A música é a banda sonora da tua vida.',
      text_en: 'Music is the soundtrack of your life.',
      text_es: 'La música es la banda sonora de tu vida.',
      text_fr: 'La musique est la bande originale de votre vie.',
      text_it: 'La musica è la colonna sonora della tua vita.',
      author: 'Dick Clark'
    },
    {
      text_pt: 'A música dá alma ao universo, asas à mente, voo à imaginação e vida a tudo.',
      text_en: 'Music gives a soul to the universe, wings to the mind, flight to the imagination, and life to everything.',
      text_es: 'La música le da alma al universo, alas a la mente, vuelo a la imaginación y vida a todo.',
      text_fr: 'La musique donne une âme à l\'univers, des ailes à l\'esprit, le vol à l\'imagination et la vie à tout.',
      text_it: 'La musica dà anima all\'universo, ali alla mente, volo all\'immaginazione e vita a tutto.',
      author: 'Platão'
    },
    {
      text_pt: 'Se a música é o alimento do amor, então continuem a tocar.',
      text_en: 'If music is the food of love, play on.',
      text_es: 'Si la música es el alimento del amor, sigan tocando.',
      text_fr: 'Si la musique est la nourriture de l\'amour, jouez encore.',
      text_it: 'Se la musica è il cibo dell\'amore, continuate a suonare.',
      author: 'William Shakespeare'
    }
  ];

  container.innerHTML = quotes.map(q => `
    <div class="quote-card">
      <div class="quote-card-text">${q[`text_${currentLang}`] || q.text_en || q.text_pt}</div>
      <div class="quote-card-author">${q.author}</div>
    </div>
  `).join('');
}

function renderSongOfTheDay() {
  const container = document.getElementById('songOfTheDay');
  if (!container) return;
  const song = getSongOfTheDay();
  if (!song) {
    container.innerHTML = '';
    return;
  }
  const lang = currentLang;
  const labels = i18n;

  container.innerHTML = `
    <div class="song-of-the-day" onclick="navigateTo('song', ${song.id})">
      <div class="song-of-the-day-cover">
        <img src="${song.cover}" alt="${song.title}" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%231b1b1d%22 width=%22200%22 height=%22200%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2240%22>♪</text></svg>'">
        <div class="song-of-the-day-badge">${i18n[lang].song_of_the_day}</div>
      </div>
      <div class="song-of-the-day-info">
        <h3>${song.title}</h3>
        <div class="artist">${song.artist}</div>
        <div class="description">${song['description_' + currentLang] || song.description}</div>
        <div class="tags">
          <span class="tag">${song.style}</span>
          <span class="tag">${song.mood}</span>
          ${song.date ? `<span class="tag">${new Date(song.date).getFullYear()}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Galeria de capas — scroll infinito
 */
function renderCoverGallery() {
  const track = document.getElementById('coverGalleryTrack');
  if (!track) return;

  const covers = songs.map(s => `
    <div class="cover-gallery-item" onclick="navigateTo('song', ${s.id})">
      <img src="${s.cover}" alt="${s.title}" loading="lazy" draggable="false" class="no-download"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%231b1b1d%22 width=%22200%22 height=%22200%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23D4AF37%22 font-size=%2240%22>♪</text></svg>'">
      <div class="cover-label">${s.title}</div>
    </div>
  `).join('');

  // Duplicar para scroll infinito
  track.innerHTML = covers + covers;
}

/**
 * Fade-in ao scroll (Intersection Observer)
 */
function initFadeInOnScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in-element').forEach(el => observer.observe(el));
}

/**
 * Lightbox — zoom na capa ao clicar
 */
function initLightbox() {
  // Criar overlay global
  if (!window._lightbox) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <button class="lightbox-close" aria-label="${i18n[currentLang].tooltip_close}">×</button>
      <img src="" alt="${i18n[currentLang].cover_enlarged}">
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
        closeLightbox();
      }
    });
    document.body.appendChild(overlay);
    window._lightbox = overlay;
  }
}

function openLightbox(src, alt) {
  const lb = window._lightbox;
  if (!lb) return;
  const img = lb.querySelector('img');
  img.src = src;
  img.alt = alt || i18n[currentLang].cover_enlarged;
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = window._lightbox;
  if (!lb) return;
  lb.classList.remove('active');
  document.body.style.overflow = '';
}

// Fechar com Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

/**
 * Anti-download — bloquear右键, drag, long-press
 */
function initAntiDownload() {
  // Bloquear右键 em todas as imagens
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('.song-detail-cover, .song-card-cover, .cover-gallery-item')) {
      e.preventDefault();
      return false;
    }
  });

  // Bloquear drag em imagens
  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  });

  // Bloquear long-press no telemóvel
  let longPressTimer;
  document.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('.song-detail-cover, .song-card-cover, .cover-gallery-item')) {
      longPressTimer = setTimeout(() => {
        e.preventDefault();
      }, 500);
    }
  }, { passive: false });

  document.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
  });

  document.addEventListener('touchmove', () => {
    clearTimeout(longPressTimer);
  });
}


/* ═══════════════════════════════════════════════════════════════
   INIT — Ponto de entrada da aplicação
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Loading
  hideLoadingScreen();

  // Aplicar overrides de músicas do admin
  if (typeof SongManager !== 'undefined') SongManager.init();

  // Tema
  applyTheme();

  // Idioma
  applyLanguage();

  // Contagem de músicas no hero
  updateHeroSongCount();

  // Partículas
  createParticles();

  // Navbar scroll
  initNavbarScroll();

  // Animações scroll
  initScrollAnimations();

  // Atalhos teclado
  initKeyboardShortcuts();

  // Audio hover preview
  setupAudioHover();

  // Botão voltar ao topo
  initBackToTop();

  // Cookie consent
  initCookieConsent();

  // Música do dia
  renderSongOfTheDay();

  // Citações
  renderQuotes();

  // Galeria de capas
  renderCoverGallery();

  // Subscritor nav
  renderSubscriberNav();

  // Fade-in ao scroll
  initFadeInOnScroll();

  // Lightbox zoom
  initLightbox();

  // Anti-download
  initAntiDownload();

  // Obter IP do utilizador (para proteção de voto)
  fetchUserIP();

  // Roteamento por hash
  if (window.location.hash.startsWith('#admin')) {
    initAdmin();
  } else {
    handleHash();
  }

  // PWA - Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Analytics - Visitor counter
  initAnalytics();

  // PWA Install prompt
  initPWAInstall();
});


/* ═══════════════════════════════════════════════════════════════
   ANALYTICS — Contador de visitantes (LocalStorage)
   ═══════════════════════════════════════════════════════════════ */
function initAnalytics() {
  const today = new Date().toISOString().slice(0, 10);
  const analytics = Storage.get('analytics') || { total: 0, daily: {}, pages: {} };

  // Contar visita
  analytics.total = (analytics.total || 0) + 1;
  analytics.daily[today] = (analytics.daily[today] || 0) + 1;

  // Contar página atual
  const page = window.location.hash.replace('#', '') || 'home';
  analytics.pages[page] = (analytics.pages[page] || 0) + 1;

  Storage.set('analytics', analytics);
}


/* ═══════════════════════════════════════════════════════════════
   PWA INSTALL — Botão de instalação da app
   ═══════════════════════════════════════════════════════════════ */
let deferredPrompt = null;

function initPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
}

function showInstallBanner() {
  if (Storage.get('install_dismissed')) return;
  if (document.getElementById('pwaInstallBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwaInstallBanner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-install-content">
      <span>📱 Instalar PROFEF como app</span>
      <div class="pwa-install-actions">
        <button class="btn btn-primary btn-sm" onclick="installPWA()">Instalar</button>
        <button class="btn btn-ghost btn-sm" onclick="dismissInstall()">Depois</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
}

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((result) => {
    if (result.outcome === 'accepted') {
      Storage.set('install_dismissed', true);
    }
    deferredPrompt = null;
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.remove();
  });
}

function dismissInstall() {
  Storage.set('install_dismissed', true);
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) banner.remove();
}


/* ═══════════════════════════════════════════════════════════════
   SOCIAL SHARE — Partilhar músicas
   ═══════════════════════════════════════════════════════════════ */

function copySongLink(songId) {
  const song = getSongById(songId);
  if (!song) return;
  const url = window.location.origin + window.location.pathname + '#song/' + song.id;
  navigator.clipboard.writeText(url).then(() => {
    const L = i18n[currentLang];
    const btn = document.querySelector('.share-copy-btn');
    if (btn) {
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = '📋'; }, 1500);
    }
  });
}

function shareToFacebook(songId) {
  const song = getSongById(songId);
  if (!song) return;
  const url = window.location.origin + window.location.pathname + '#song/' + song.id;
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
}

function shareToWhatsApp(songId) {
  const song = getSongById(songId);
  if (!song) return;
  const url = window.location.origin + window.location.pathname + '#song/' + song.id;
  const text = `${song.title} — ${song.artist}\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function toggleShareMenu(songId) {
  const menu = document.getElementById('shareMenu-' + songId);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

// Fechar menus de share ao clicar fora
document.addEventListener('click', (e) => {
  if (!e.target.closest('.share-group')) {
    document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('open'));
  }
});


/* ═══════════════════════════════════════════════════════════════
   NEWSLETTER — Subscrição por email (LocalStorage)
   ═══════════════════════════════════════════════════════════════ */
function subscribeNewsletter(e) {
  e.preventDefault();
  const email = document.getElementById('newsletterEmail').value.trim();
  if (!email) return;

  const subs = Storage.get('newsletter_subscribers') || [];
  if (subs.find(s => s.email === email)) {
    alert('Este email já está subscrito!');
    return;
  }

  subs.push({ email, date: new Date().toISOString() });
  Storage.set('newsletter_subscribers', subs);

  document.getElementById('newsletterEmail').value = '';
  document.getElementById('newsletterSuccess').style.display = 'block';
  document.getElementById('newsletterBtn').disabled = true;
  document.getElementById('newsletterBtn').textContent = 'Subscrito ✓';

  setTimeout(() => {
    document.getElementById('newsletterSuccess').style.display = 'none';
    document.getElementById('newsletterBtn').disabled = false;
    document.getElementById('newsletterBtn').textContent = 'Subscrever';
  }, 3000);
}
