/* ============================================================
   AURA — i18n.js  v1.0
   Bilingual support: English (default) · French
   Auto-detects from navigator.language, falls back to 'en'.
   Manual override stored in localStorage as 'aura_lang'.
   ============================================================ */

(function () {

  /* ────────── TRANSLATIONS ────────── */
  const LANGS = {

    en: {
      /* Login */
      login_wordmark:       'AURA',
      login_sub:            'Connect your Last.fm account',
      login_label_user:     'Username',
      login_placeholder_user: 'your_username',
      login_label_key:      'Last.fm API Key',
      login_placeholder_key: '32 characters',
      login_btn:            'Enter →',
      login_cached_label:   'Continue as',
      login_err_user:       'Enter your Last.fm username.',
      login_err_key:        'Invalid API key (32 hex characters).',

      /* Loading */
      loading_text:         'Connecting…',

      /* Player — no track */
      no_track_title:       'Waiting for a music signal…',
      no_track_sub:         'Play something on Spotify or Last.fm',

      /* Status bar */
      status_connecting:    'Connecting…',
      status_live:          'Live',
      status_viewing:       'Viewing: ',
      status_network_err:   'Network error',
      status_sync:          '⚡ AURA Sync · ',
      status_loading:       'Loading…',

      /* History panel */
      hist_label:           '/ Recently played',
      hist_empty:           'No history yet.',

      /* Lyrics panel */
      lyrics_waiting:       'Waiting for a track…',
      lyrics_fetching:      'Loading lyrics…',
      lyrics_not_found:     'No lyrics found.',
      lyrics_synced_badge:  '● Synced',
      lyrics_plain_badge:   'Plain text',

      /* Settings tabs */
      tab_sync:     'Connection',
      tab_layout:   'Display',
      tab_visual:   'Appearance',
      tab_lyrics:   'Lyrics',

      /* Settings — Connection tab */
      settings_title:           'Settings',
      sync_section_sources:     'Data sources',
      sync_card_lastfm:         'Last.fm',
      sync_user_placeholder:    'View another user…',
      sync_user_hint:           'Press Enter to switch account',
      sync_discord_title:       'Discord · Lanyard',
      sync_discord_live_badge:  'Live',
      sync_discord_desc:        'Displays your music in real time via your Discord status (through Lanyard).',
      sync_discord_id_placeholder: 'Your Discord ID…',
      sync_discord_btn_connect: 'Connect',
      sync_discord_btn_disconnect: 'Disconnect',
      sync_discord_off:         'Disabled — enter an ID to activate',
      sync_discord_help_title:  'Where to find your ID?',
      sync_discord_help_body:   'Discord → Settings → Advanced → Enable Developer Mode\nRight-click your profile → Copy User ID',
      sync_section_flow:        'Flow configuration',
      sync_priority_label:      'Priority source',
      sync_priority_discord_label: 'Discord Focus',
      sync_priority_discord_desc:  'Real-time via Lanyard. Falls back to Last.fm automatically if nothing is playing.',
      sync_priority_lastfm_label:  'Last.fm Focus',
      sync_priority_lastfm_desc:   'Scrobble history only. Discord status is ignored.',
      sync_priority_status_discord: 'When connected via Discord, your Spotify music appears in real time. Otherwise, AURA uses Last.fm automatically.',
      sync_priority_status_lastfm:  'Discord status is ignored. AURA relies solely on your Last.fm scrobbles.',
      sync_section_display:     'Display preferences',
      sync_extended_stats:      'Extended stats',
      sync_extended_hint:       'Show play count under the track title.',
      sync_stats_of:            'Show plays for',
      sync_stats_artist:        'Artist',
      sync_stats_album:         'Album',
      sync_own_stats:           'My personal stats',
      sync_open_on_start:       'Open on startup',
      sync_open_lyrics:         'Lyrics',
      sync_open_history:        'History',
      sync_open_none:           'Nothing',
      sync_section_dev:         'Development',
      sync_test_mode_btn:       '▶ Enable Test Mode',
      sync_test_mode_off:       '⏹ Stop Test Mode',
      sync_test_desc:           'Simulates a listening session without Spotify or Last.fm. Useful for testing animations, artwork and gradients.',
      sync_logout:              'Log out',

      /* Settings — Display tab */
      disp_hero_scale:          'Main screen size',
      disp_view:                'View',
      disp_view_full:           'Full',
      disp_view_minimal:        'Minimal',
      disp_view_full_desc:      'Full display with artwork and track information.',
      disp_view_minimal_desc:   'Just a progress bar and the track title.',
      disp_position:            'Content position',
      disp_pos_left:            '← Left',
      disp_pos_center:          '· Center',
      disp_pos_right:           'Right →',
      disp_artwork:             'Album artwork',
      disp_shape:               'Shape',
      disp_shape_round:         'Rounded',
      disp_shape_circle:        'Circle',
      disp_shape_square:        'Square',
      disp_glow:                'Glow around artwork',
      disp_glow_pulse:          '✨ Pulsed glow',
      disp_show_art:            'Show artwork',
      disp_floating_art:        'Floating artwork',
      disp_what_to_show:        'What to display',
      disp_bg_image:            'Background image (blurred artwork)',
      disp_artist_photo:        'Artist photo',
      disp_bg_text:             'Large background text',
      disp_progress_bar:        'Progress bar',
      disp_shortcuts:           'Keyboard shortcuts',
      disp_shortcuts_note:      '(desktop only)',
      key_lyrics:    'Lyrics',
      key_history:   'History',
      key_settings:  'Settings',
      key_fullscreen:'Fullscreen',
      key_hide:      'Hide',
      key_focus:     'Focus',
      key_close:     'Close',

      /* Settings — Appearance tab */
      app_accent_color:     'Accent color',
      app_color_pink:       'Pink',
      app_color_violet:     'Violet',
      app_color_blue:       'Blue',
      app_color_green:      'Green',
      app_color_orange:     'Orange',
      app_color_lightpink:  'Light pink',
      app_color_white:      'White',
      app_effects:          'Effects',
      app_vinyl:            '🎵 Vinyl mode',
      app_auto_colors:      '🎨 Auto colors (from artwork)',
      app_font:             'Font',
      app_font_aura:        'Aura',
      app_font_inter:       'Inter',
      app_font_modern:      'Modern',
      app_font_serif:       'Serif',
      app_font_mono:        'Mono',
      app_clean_style:      '🎵 Clean style',
      app_bg:               'Background',
      app_bg_mode:          'Mode',
      app_bg_album:         'Album',
      app_bg_color:         'Color',
      app_bg_dark:          'Dark',
      app_bg_title:         '🌈 Title',
      app_bg_movement:      'Background movement',
      app_bg_still:         'Still',
      app_bg_blobs:         'Blobs',
      app_bg_light:         'Light',
      app_bg_energetic:     'Energetic',
      app_bg_floating:      'Floating',
      app_gradient:         '🌊 Color gradient',
      app_grain:            '✦ Film grain',
      app_blur:             'Background blur',
      app_brightness:       'Brightness',
      app_saturation:       'Saturation',
      app_blur_sharp:       'Sharp',
      app_blur_very:        'Very blurry',
      app_brightness_dark:  'Dark',
      app_brightness_light: 'Light',
      app_sat_grey:         'Grey',
      app_sat_vivid:        'Vivid',
      app_audio_fx:         'Audio effects',
      app_eq_bars:          '📊 Sound bars',
      app_spectrum:         '🌈 Sound spectrum',
      app_fluidity:         '🎯 Smoothness',
      app_fps_high:         'High',
      app_fps_eco:          'Eco',
      app_bg_text_speed:    'Background text speed',
      app_slow:             'Slow',
      app_fast:             'Fast',

      /* Settings — Lyrics tab */
      lyr_size:             'Text size',
      lyr_size_small:       'Small',
      lyr_size_large:       'Large',
      lyr_style:            'Writing style',
      lyr_style_classic:    'Classic',
      lyr_style_simple:     'Simple',
      lyr_style_machine:    'Machine',
      lyr_style_impact:     'Impact',
      lyr_text_color:       '🎨 Text color',
      lyr_color_auto:       'Auto color (from artwork)',
      lyr_active_line:      'Active line',
      lyr_other_lines:      'Other lines',
      lyr_bg:               '🌙 Lyrics background',
      lyr_bg_none:          'None',
      lyr_bg_dark:          'Dark',
      lyr_bg_custom:        'Custom',
      lyr_bg_artwork:       '🌈 Artwork',
      lyr_bg_color_label:   'Background color',
      lyr_bg_intensity:     'Intensity',
      lyr_bg_transparent:   'Transparent',
      lyr_bg_opaque:        'Opaque',
      lyr_anim:             '✨ Text animation',
      lyr_anim_fade:        'Fade',
      lyr_anim_slide:       'Slide',
      lyr_anim_scale:       'Zoom',
      lyr_anim_blur:        'Blur',
      lyr_anim_bounce:      'Bounce',
      lyr_anim_none:        'None',
      lyr_autoscroll:       'Follow active line',
      lyr_title_anim:       '🎵 Title entrance effect',
      lyr_title_rise:       'Rise',
      lyr_title_drop:       'Drop',
      lyr_title_slide:      'Slide →',
      lyr_title_slide_r:    'Slide ←',
      lyr_title_zoom:       'Zoom',
      lyr_title_zoom_out:   'Zoom out',
      lyr_title_blur:       'Blur',
      lyr_title_flip:       'Flip',
      lyr_title_swing:      'Swing',
      lyr_title_split:      'Split',
      lyr_title_glitch:     'Glitch',
      lyr_title_none:       'None',
      lyr_dots:             '✦ Glowing dots (color background)',
      lyr_show_dots:        'Show dots',
      lyr_dots_color:       'Color',
      lyr_dots_brightness:  'Brightness',
      lyr_dots_dim:         'Dim',
      lyr_dots_bright:      'Bright',
      lyr_dots_size:        'Size',
      lyr_dots_small:       'Small',
      lyr_dots_large:       'Large',
      lyr_dots_speed:       'Speed',
      lyr_dots_slow:        'Slow',
      lyr_dots_fast:        'Fast',
      lyr_dots_anim_orbit:  'Orbit',
      lyr_dots_anim_pulse:  'Pulse',
      lyr_dots_anim_wave:   'Wave',
      lyr_dots_anim_sparkle:'Sparkle',
      lyr_timing:           '⏱ Lyrics timing',
      lyr_timing_desc:      'Adjust if lyrics appear too early or too late.',
      lyr_readability:      '🎨 Readability',
      lyr_adaptive_colors:  'Adaptive colors',
      lyr_blur_behind:      'Blur behind lyrics',
      lyr_blur_none:        'None',
      lyr_blur_max:         'Max',
      lyr_shadow_offset:    'Shadow offset',
      lyr_shadow_blur:      'Shadow softness',
      lyr_shadow_sharp:     'Sharp',
      lyr_shadow_soft:      'Soft',
      lyr_shadow_intensity: 'Shadow intensity',
      lyr_shadow_hidden:    'Hidden',
      lyr_shadow_strong:    'Strong',
      lyr_position:         '📌 Lyrics position',
      lyr_pos_side:         'Side',
      lyr_pos_center:       'Center',
      lyr_pos_bottom:       'Bottom',
      lyr_pos_side_desc:    'Lyrics on the right side of the screen.',
      lyr_pos_center_desc:  'Lyrics centered on screen, over the background.',
      lyr_pos_bottom_desc:  'Lyrics at the bottom, full width.',
      lyr_panel_style:      '🌐 Panel style',
      lyr_panel_discrete:   'Subtle',
      lyr_panel_colorful:   '🍎 Colorful',
      lyr_panel_subtle_desc:'Simple transparent panel.',
      lyr_panel_color_desc: 'Animated color gradient from artwork.',

      /* Top bar buttons */
      btn_lyrics:    'Lyrics',
      btn_history:   'History',
      btn_settings:  'Settings',
      btn_fullscreen:'Fullscreen',
      btn_focus:     'Focus',

      /* Mobile nav */
      mnav_lyrics:   'Lyrics',
      mnav_history:  'History',
      mnav_settings: 'Settings',
      mnav_focus:    'Focus',

      /* Stats */
      stats_plays_artist:   'artist plays',
      stats_plays_album:    'album plays',
      stats_plays_personal: 'mine',
      stats_plays_track:    '× this track',
      stats_switch_album:   'Album',
      stats_switch_artist:  'Artist',
      stats_scope_artist:   'artist plays',
      stats_scope_album:    'album plays',
      stats_my_artist:      'my plays',
      stats_my_track:       'my plays',

      /* Language section */
      sync_section_lang:    'Language',

      /* Ctx menu */
      ctx_lastfm: 'Last.fm',
      ctx_share:  'Share',

      /* Lanyard dot states */
      lanyard_connecting:   'Connecting…',
      lanyard_reconnecting: 'Reconnecting in 5s…',
      lanyard_no_music:     'No music detected',
      lanyard_test:         '🧪 Test mode active',
      lanyard_invalid_id:   'Invalid ID — expected 17 to 19 digits',
      lanyard_timeout:      'Timeout — try again in a few seconds',
      lanyard_ws_error:     'Connection failed — check your network',
      lanyard_ws_unsupported:'WebSocket not supported by this browser',
    },

    fr: {
      /* Login */
      login_wordmark:       'AURA',
      login_sub:            'Connectez votre compte Last.fm',
      login_label_user:     'Nom d\'utilisateur',
      login_placeholder_user: 'votre_pseudo',
      login_label_key:      'Clé API Last.fm',
      login_placeholder_key: '32 caractères',
      login_btn:            'Entrer →',
      login_cached_label:   'Continuer en tant que',
      login_err_user:       'Entrez votre pseudo Last.fm.',
      login_err_key:        'Clé API invalide (32 caractères hex).',

      /* Loading */
      loading_text:         'Connexion…',

      /* Player — no track */
      no_track_title:       'En attente d\'une onde musicale…',
      no_track_sub:         'Joue une musique sur Spotify ou Last.fm',

      /* Status bar */
      status_connecting:    'Connexion…',
      status_live:          'Live',
      status_viewing:       'Viewing: ',
      status_network_err:   'Erreur réseau',
      status_sync:          '⚡ AURA Sync · ',
      status_loading:       'Chargement…',

      /* History panel */
      hist_label:           '/ Écoutés récemment',
      hist_empty:           'Aucun historique.',

      /* Lyrics panel */
      lyrics_waiting:       'En attente d\'un titre…',
      lyrics_fetching:      'Chargement des paroles…',
      lyrics_not_found:     'Paroles introuvables.',
      lyrics_synced_badge:  '● Synchronisées',
      lyrics_plain_badge:   'Texte brut',

      /* Settings tabs */
      tab_sync:     'Connexion',
      tab_layout:   'Affichage',
      tab_visual:   'Apparence',
      tab_lyrics:   'Paroles',

      /* Settings — Connection tab */
      settings_title:           'Réglages',
      sync_section_sources:     'Sources de données',
      sync_card_lastfm:         'Last.fm',
      sync_user_placeholder:    'Voir un autre utilisateur…',
      sync_user_hint:           'Appuie sur Entrée pour changer de compte',
      sync_discord_title:       'Discord · Lanyard',
      sync_discord_live_badge:  'En direct',
      sync_discord_desc:        'Affiche ta musique Spotify en temps réel grâce à ton statut Discord (via Lanyard).',
      sync_discord_id_placeholder: 'Ton identifiant Discord…',
      sync_discord_btn_connect: 'Connecter',
      sync_discord_btn_disconnect: 'Déconnecter',
      sync_discord_off:         'Désactivé — entre un identifiant pour activer',
      sync_discord_help_title:  'Où trouver ton identifiant ?',
      sync_discord_help_body:   'Discord → Paramètres → Avancé → Active le mode développeur\nClic droit sur ton profil → Copier l\'identifiant',
      sync_section_flow:        'Configuration du flux',
      sync_priority_label:      'Source prioritaire',
      sync_priority_discord_label: 'Focus Discord',
      sync_priority_discord_desc:  'Temps réel via Lanyard. Repli automatique sur Last.fm si rien ne joue.',
      sync_priority_lastfm_label:  'Focus Last.fm',
      sync_priority_lastfm_desc:   'Historique de scrobbles uniquement. Le statut Discord est ignoré.',
      sync_priority_status_discord: 'Si tu es connecté via Discord, ta musique Spotify s\'affiche en temps réel. Sinon, AURA utilise Last.fm automatiquement.',
      sync_priority_status_lastfm:  'Le statut Discord est ignoré. AURA se base uniquement sur tes scrobbles Last.fm.',
      sync_section_display:     'Préférences d\'affichage',
      sync_extended_stats:      'Statistiques étendues',
      sync_extended_hint:       'Affiche le nombre d\'écoutes sous le titre.',
      sync_stats_of:            'Afficher les écoutes de',
      sync_stats_artist:        'Artiste',
      sync_stats_album:         'Album',
      sync_own_stats:           'Mes stats personnelles',
      sync_open_on_start:       'Ouvrir au démarrage',
      sync_open_lyrics:         'Paroles',
      sync_open_history:        'Historique',
      sync_open_none:           'Rien',
      sync_section_dev:         'Développement',
      sync_test_mode_btn:       '▶ Activer le Mode Test',
      sync_test_mode_off:       '⏹ Arrêter le Mode Test',
      sync_test_desc:           'Simule une écoute sans Spotify ni Last.fm. Utile pour tester les animations, la pochette et le dégradé.',
      sync_logout:              'Se déconnecter',

      /* Settings — Display tab */
      disp_hero_scale:          'Taille de l\'écran principal',
      disp_view:                'Vue',
      disp_view_full:           'Complète',
      disp_view_minimal:        'Minimaliste',
      disp_view_full_desc:      'Affichage complet avec pochette et informations du morceau.',
      disp_view_minimal_desc:   'Juste une barre de progression et le titre du morceau.',
      disp_position:            'Position du contenu',
      disp_pos_left:            '← Gauche',
      disp_pos_center:          '· Centre',
      disp_pos_right:           'Droite →',
      disp_artwork:             'Pochette d\'album',
      disp_shape:               'Forme',
      disp_shape_round:         'Arrondie',
      disp_shape_circle:        'Cercle',
      disp_shape_square:        'Carrée',
      disp_glow:                'Lueur autour de la pochette',
      disp_glow_pulse:          '✨ Lueur pulsée',
      disp_show_art:            'Afficher la pochette',
      disp_floating_art:        'Pochette flottante',
      disp_what_to_show:        'Ce qu\'on affiche',
      disp_bg_image:            'Image de fond (pochette floutée)',
      disp_artist_photo:        'Photo de l\'artiste',
      disp_bg_text:             'Texte géant en fond',
      disp_progress_bar:        'Barre de progression',
      disp_shortcuts:           'Raccourcis clavier',
      disp_shortcuts_note:      '(bureau uniquement)',
      key_lyrics:    'Paroles',
      key_history:   'Historique',
      key_settings:  'Réglages',
      key_fullscreen:'Plein écran',
      key_hide:      'Masquer',
      key_focus:     'Focus',
      key_close:     'Fermer',

      /* Settings — Appearance tab */
      app_accent_color:     'Couleur principale',
      app_color_pink:       'Rose',
      app_color_violet:     'Violet',
      app_color_blue:       'Bleu',
      app_color_green:      'Vert',
      app_color_orange:     'Orange',
      app_color_lightpink:  'Rose clair',
      app_color_white:      'Blanc',
      app_effects:          'Effets',
      app_vinyl:            '🎵 Mode vinyle',
      app_auto_colors:      '🎨 Couleurs auto (selon la pochette)',
      app_font:             'Police d\'écriture',
      app_font_aura:        'Aura',
      app_font_inter:       'Inter',
      app_font_modern:      'Moderne',
      app_font_serif:       'Serif',
      app_font_mono:        'Mono',
      app_clean_style:      '🎵 Style épuré',
      app_bg:               'Fond',
      app_bg_mode:          'Mode',
      app_bg_album:         'Album',
      app_bg_color:         'Couleur',
      app_bg_dark:          'Sombre',
      app_bg_title:         '🌈 Titre',
      app_bg_movement:      'Mouvement du fond',
      app_bg_still:         'Calme',
      app_bg_blobs:         'Bulles',
      app_bg_light:         'Légère',
      app_bg_energetic:     'Énergique',
      app_bg_floating:      'Flottante',
      app_gradient:         '🌊 Dégradé de couleurs',
      app_grain:            '✦ Grain de film',
      app_blur:             'Flou du fond',
      app_brightness:       'Luminosité',
      app_saturation:       'Saturation',
      app_blur_sharp:       'Net',
      app_blur_very:        'Très flou',
      app_brightness_dark:  'Sombre',
      app_brightness_light: 'Clair',
      app_sat_grey:         'Gris',
      app_sat_vivid:        'Vives',
      app_audio_fx:         'Effets audio',
      app_eq_bars:          '📊 Barres sonores',
      app_spectrum:         '🌈 Spectre de sons',
      app_fluidity:         '🎯 Fluidité',
      app_fps_high:         'Haute',
      app_fps_eco:          'Éco',
      app_bg_text_speed:    'Vitesse du texte en fond',
      app_slow:             'Lent',
      app_fast:             'Rapide',

      /* Settings — Lyrics tab */
      lyr_size:             'Taille du texte',
      lyr_size_small:       'Petit',
      lyr_size_large:       'Grand',
      lyr_style:            'Style d\'écriture',
      lyr_style_classic:    'Classique',
      lyr_style_simple:     'Simple',
      lyr_style_machine:    'Machine',
      lyr_style_impact:     'Impact',
      lyr_text_color:       '🎨 Couleur du texte',
      lyr_color_auto:       'Couleur auto (depuis la pochette)',
      lyr_active_line:      'Ligne en cours',
      lyr_other_lines:      'Autres lignes',
      lyr_bg:               '🌙 Fond des paroles',
      lyr_bg_none:          'Aucun',
      lyr_bg_dark:          'Sombre',
      lyr_bg_custom:        'Ma couleur',
      lyr_bg_artwork:       '🌈 Pochette',
      lyr_bg_color_label:   'Couleur du fond',
      lyr_bg_intensity:     'Intensité',
      lyr_bg_transparent:   'Transparent',
      lyr_bg_opaque:        'Opaque',
      lyr_anim:             '✨ Animation du texte',
      lyr_anim_fade:        'Fondu',
      lyr_anim_slide:       'Glisse',
      lyr_anim_scale:       'Zoom',
      lyr_anim_blur:        'Flou',
      lyr_anim_bounce:      'Rebond',
      lyr_anim_none:        'Aucune',
      lyr_autoscroll:       'Suivre la ligne en cours',
      lyr_title_anim:       '🎵 Effet d\'entrée du titre',
      lyr_title_rise:       'Monte',
      lyr_title_drop:       'Descend',
      lyr_title_slide:      'Glisse →',
      lyr_title_slide_r:    'Glisse ←',
      lyr_title_zoom:       'Zoom',
      lyr_title_zoom_out:   'Zoom arrière',
      lyr_title_blur:       'Flou',
      lyr_title_flip:       'Flip',
      lyr_title_swing:      'Swing',
      lyr_title_split:      'Éclatement',
      lyr_title_glitch:     'Glitch',
      lyr_title_none:       'Aucun',
      lyr_dots:             '✦ Points lumineux (fond couleurs)',
      lyr_show_dots:        'Afficher les points',
      lyr_dots_color:       'Couleur',
      lyr_dots_brightness:  'Luminosité',
      lyr_dots_dim:         'Discret',
      lyr_dots_bright:      'Brillant',
      lyr_dots_size:        'Taille',
      lyr_dots_small:       'Petits',
      lyr_dots_large:       'Grands',
      lyr_dots_speed:       'Vitesse',
      lyr_dots_slow:        'Lent',
      lyr_dots_fast:        'Rapide',
      lyr_dots_anim_orbit:  'Orbite',
      lyr_dots_anim_pulse:  'Pulsation',
      lyr_dots_anim_wave:   'Vague',
      lyr_dots_anim_sparkle:'Éclat',
      lyr_timing:           '⏱ Timing des paroles',
      lyr_timing_desc:      'Ajuste si les paroles s\'affichent trop tôt ou trop tard.',
      lyr_readability:      '🎨 Lisibilité',
      lyr_adaptive_colors:  'Couleurs adaptées au fond',
      lyr_blur_behind:      'Flou derrière les paroles',
      lyr_blur_none:        'Aucun',
      lyr_blur_max:         'Max',
      lyr_shadow_offset:    'Décalage de l\'ombre',
      lyr_shadow_blur:      'Douceur de l\'ombre',
      lyr_shadow_sharp:     'Nette',
      lyr_shadow_soft:      'Douce',
      lyr_shadow_intensity: 'Intensité de l\'ombre',
      lyr_shadow_hidden:    'Invisible',
      lyr_shadow_strong:    'Forte',
      lyr_position:         '📌 Emplacement des paroles',
      lyr_pos_side:         'Côté',
      lyr_pos_center:       'Centre',
      lyr_pos_bottom:       'Bas',
      lyr_pos_side_desc:    'Paroles sur le côté droit de l\'écran.',
      lyr_pos_center_desc:  'Paroles au centre de l\'écran, par-dessus le fond.',
      lyr_pos_bottom_desc:  'Paroles en bas de l\'écran, pleine largeur.',
      lyr_panel_style:      '🌐 Style du panneau',
      lyr_panel_discrete:   'Discret',
      lyr_panel_colorful:   '🍎 Coloré',
      lyr_panel_subtle_desc:'Panneau transparent simple.',
      lyr_panel_color_desc: 'Dégradé de couleurs animé depuis la pochette.',

      /* Top bar buttons */
      btn_lyrics:    'Paroles',
      btn_history:   'Historique',
      btn_settings:  'Réglages',
      btn_fullscreen:'Plein écran',
      btn_focus:     'Focus',

      /* Mobile nav */
      mnav_lyrics:   'Paroles',
      mnav_history:  'Historique',
      mnav_settings: 'Réglages',
      mnav_focus:    'Focus',

      /* Stats */
      stats_plays_artist:   'écoutes artiste',
      stats_plays_album:    'écoutes album',
      stats_plays_personal: 'perso',
      stats_plays_track:    '× ce titre',
      stats_switch_album:   'Album',
      stats_switch_artist:  'Artiste',
      stats_scope_artist:   'écoutes artiste',
      stats_scope_album:    'écoutes album',
      stats_my_artist:      'mes écoutes',
      stats_my_track:       'mes écoutes',

      /* Language section */
      sync_section_lang:    'Langue',

      /* Ctx menu */
      ctx_lastfm: 'Last.fm',
      ctx_share:  'Partager',

      /* Lanyard dot states */
      lanyard_connecting:   'Connexion en cours…',
      lanyard_reconnecting: 'Reconnexion dans 5s…',
      lanyard_no_music:     'Aucune musique détectée',
      lanyard_test:         '🧪 Mode Test actif',
      lanyard_invalid_id:   'ID invalide — 17 à 19 chiffres attendus',
      lanyard_timeout:      'Délai dépassé — réessaye dans quelques secondes',
      lanyard_ws_error:     'Connexion échouée — vérifie ton réseau',
      lanyard_ws_unsupported:'WebSocket non supporté par ce navigateur',
    },
  };

  /* ────────── LANGUAGE DETECTION ────────── */
  function detectLang() {
    const stored = (() => { try { return localStorage.getItem('aura_lang'); } catch { return null; } })();
    if (stored && LANGS[stored]) return stored;
    const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (nav.startsWith('fr')) return 'fr';
    return 'en';
  }

  let _lang = detectLang();

  /* ────────── PUBLIC API ────────── */
  window.AURA_LANGS = LANGS;

  /** t(key) — get translated string for current language */
  window.t = function (key) {
    return LANGS[_lang]?.[key] ?? LANGS['en']?.[key] ?? key;
  };

  /** setLang(code) — switch language at runtime */
  window.setLang = function (code) {
    if (!LANGS[code]) return;
    _lang = code;
    try { localStorage.setItem('aura_lang', code); } catch {}
    applyI18n();
    // Re-fire any dynamic strings that script.js controls
    document.dispatchEvent(new CustomEvent('aura:langchange', { detail: { lang: code } }));
  };

  /** getLang() — returns current language code */
  window.getLang = function () { return _lang; };

  /* ────────── DOM APPLICATION ────────── */
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = window.t(key);
      if (el.tagName === 'INPUT') {
        const attr = el.getAttribute('data-i18n-attr') || 'placeholder';
        el.setAttribute(attr, val);
      } else if (el.getAttribute('data-i18n-attr')) {
        el.setAttribute(el.getAttribute('data-i18n-attr'), val);
      } else {
        el.textContent = val;
      }
    });

    // Language toggle button label
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) langBtn.textContent = _lang === 'fr' ? 'EN' : 'FR';

    // html lang attribute
    document.documentElement.lang = _lang;
  }

  /* Apply on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyI18n);
  } else {
    applyI18n();
  }

})();
