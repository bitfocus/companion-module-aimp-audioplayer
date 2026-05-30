# Companion AIMP Module

[English](#english) | [Русский](#русский)

---

## English

A Bitfocus Companion module for remote control of the AIMP music player. The module requires the **AIMP HTTP Remote Control** plugin to be installed in the player — available from the AIMP add-ons catalog on the player's website or from the [repository](https://github.com/slv-tech/AIMP-HTTP-Remote-Control).

### Build

```
npm install
npm run build
```

### Setup

Install `aimp-remote-0.5.1` in Companion via the modules menu. Enter the IP address of the device running the player and the port (default port: 19122). The update interval can be adjusted if needed — 80 ms is optimal. The port and network interface can also be changed in the plugin settings within the player itself.

---

## Русский

Модуль Bitfocus Companion для удалённого управления плеером AIMP. Для работы модуля необходимо установить плагин **AIMP HTTP Remote Control** в сам плеер — доступен из каталога дополнений на сайте плеера или из [репозитория](https://github.com/slv-tech/AIMP-HTTP-Remote-Control).

### Сборка

```
npm install
npm run build
```

### Запуск

Установить `aimp-remote-0.5.1` в Companion через меню modules. Указать IP-адрес устройства, на котором запущен плеер, и порт (стандартный порт: 19122). При необходимости можно изменить время обновления — оптимально 80 мс. Порт и интерфейс также можно изменить в настройках плагина в самом плеере.
