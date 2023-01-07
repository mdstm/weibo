// ==UserScript==
// @name         微博图片下载脚本
// @homepage     https://github.com/mdstm/weibo
// @version      7.0
// @description  下载微博网页版的图片和视频
// @author       mdstm
// @match        https://weibo.com/*
// @match        https://www.weibo.com/*
// @match        https://d.weibo.com/*
// @connect      sinaimg.cn
// @connect      weibo.com
// @connect      weibocdn.com
// @connect      youku.com
// @connect      miaopai.com
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(function() {
  'use strict';

  /**
   * 下载
   */
  function download(url, name) {
    GM_download({
      url: url,
      name: name,
      headers: [
        {name: 'referer', value: 'https://weibo.com/'}
      ],
      onerror: function() { console.error('下载 ' + name + ' 失败\n' + url); },
      ontimeout: function() { console.error('下载 ' + name + ' 超时\n' + url); }
    });
  }

  /**
   * 计算本地文件的名称
   */
   function getName(date, idx, ext) {
    let t = new Date(date.getTime() + idx * 1000).toISOString();
    t = t.substring(2, 19).replace(/[-:]/g, '').replace('T', '_');
    return t + ext;
  }

  /**
   * 从多个路径中选出第一个可达到的目标
   */
  function choice(obj, paths) {
    for (let path of paths) {
      try {
        let a = obj;
        for (let k of path) {
          a = a[k];
        }
        return a;
      } catch (e) {
        return null;
      }
    }
  }

  /**
   * 下载图片和视频
   */
  function downMedia(info) {
    let date = new Date(info.created_at); // 微博创建时间
    date.setTime(date.getTime() - date.getTimezoneOffset() * 60000); // 减去时区偏移

    // 有三种微博，图片微博、视频微博和文字微博，每个微博只能属于其中一种

    // 如果该项存在, 则是图片微博
    let pic_infos = info.pic_infos;
    if (pic_infos) {
      console.log('找到图片');
      let idx = 0; // 文件序号
      for (let pic of Object.values(pic_infos)) { // 遍历图片
        let url = pic.largest.url; // 图片链接
        let ext = url.match(/\.\w+$/)[0]; // 图片扩展名，目前只发现有 .jpg 和 .gif
        download(url, getName(date, idx++, ext)); // 下载图片
        if (ext != '.gif') {
          let video = pic.video;
          if (video) { // 如果非 gif 图片存在该视频链接，则有 LIVE
            download(video, getName(date, idx++, '.mp4')); // 下载 LIVE
          }
        }
      }
      return;
    }

    // 如果该项存在，则有可能是视频微博
    let page_info = info.page_info;
    if (page_info) {
      let url = choice(page_info, [
        ['media_info', 'playback_list', 0, 'play_info', 'url'], // 普通视频
        ['media_info', 'mp4_720p_mp4'],
        ['media_info', 'mp4_hd_url'],
        ['media_info', 'mp4_sd_url'],
        ['slide_cover', 'playback_list', 0, 'play_info', 'url'] // 微博故事
      ]);
      if (url) {
        console.log('找到视频');
        download(url, getName(date, 0, '.mp4')); // 下载视频
        return;
      }
    }

    console.log('未找到图片或视频');
  }

  /**
   * 点击下载按钮，下载当前微博的图片或视频
   */
  function click(event) {
    let a = event.currentTarget.parentNode.querySelector('.mdstm');
    let mblogid = a.href.match(/\d+\/(\w+)/)[1];

    GM_xmlhttpRequest({ // 获取微博全部信息
      method: 'GET',
      url: 'https://weibo.com/ajax/statuses/show?id=' + mblogid,
      timeout: 8000,
      responseType: 'json',
      onerror: function() { console.error('获取全部信息失败'); },
      ontimeout: function() { console.error('获取全部信息超时'); },
      onload: function(res) {
        let info = res.response;
        if (typeof info != 'object') {
          console.error('读取 json 信息失败');
          return;
        }
        console.log('获取全部信息成功');
        downMedia(info);
      }
    });
  }

  /**
   * 初始化，给微博卡片增加按钮
   */
  function init() {
    let a_list = document.querySelectorAll( // 列出未被检测的节点
      'a.head-info_time_6sFQg:nth-child(1):not(.mdstm)'
    );

    for (let a of a_list) {
      a.className += ' mdstm'; // 添加已检测标记
      let b = document.createElement('a'); // 创建下载按钮
      b.className = 'head-info_time_6sFQg';
      b.style.cursor = 'pointer';
      b.innerHTML = '下载';
      b.onclick = click;

      a.parentNode.insertBefore(b, a.nextSibling);
    }

    let n = a_list.length;
    if (n > 0) {
      console.log('添加了 ' + n + ' 个按钮');
    }
  }

  // 每 5 秒初始化一次
  setInterval(init, 5000);
})();
