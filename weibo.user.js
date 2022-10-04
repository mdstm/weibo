// ==UserScript==
// @name         微博图片下载脚本
// @homepage     https://github.com/mdstm/weibo
// @version      4.4
// @description  下载旧版微博网页版的图片和视频
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
   * 设置下载名称
   * @param   {object} info 微博信息
   * @param   {number} idx  序号
   * @param   {string} ext  扩展名，不带点
   * @returns {string}      下载名称
   */
  function setName(info, idx, ext) {
    let t = new Date(info.created_at);
    t.setTime(t.getTime() - t.getTimezoneOffset() * 60000 + idx * 1000);
    return t.toISOString().substring(2, 19).replace(/[-T:]/g, '') + '.' + ext;
  }

  /**
   * 下载
   */
  function download(url, name) {
    GM_download({
      url: url,
      name: name,
      onerror: function() { download(url, name); }
    });
  }

  /**
   * 下载视频
   */
  function downVidio(info) {
    let page_info = info.page_info;

    if (page_info == null) {
      console.log('未找到视频信息');
      return;
    }
    console.log('找到视频信息，开始下载视频');

    let media_info = page_info.media_info;
    let url;

    if (media_info == null) {
      try {
        url = page_info.slide_cover.playback_list[0].play_info.url.toString();
        download(url, setName(info, 0, 'mp4')); // 下载微博故事
      } catch (e) {
        console.error('获取微博故事链接失败');
      }
    } else {
      try {
        url = media_info.playback_list[0].play_info.url.toString();
        download(url, setName(info, 0, 'mp4')); // 下载正常视频
      } catch (e) {
        console.log('获取最高品质视频链接失败');
        if ((url = media_info.mp4_720p_mp4) || (url = media_info.mp4_hd_url)) {
          download(url, setName(info, 0, 'mp4')); // 下载低清晰度视频
        } else {
          console.error('获取微博视频链接失败');
        }
      }
    }
  }

  /**
   * 下载图片和动图
   */
  function downPicture(info) {
    let pic_infos = info.pic_infos;

    if (pic_infos == null) {
      console.log('未找到图片信息');
      downVidio(info);
      return;
    }
    console.log('找到图片信息，开始下载图片');

    let idx = 0;
    for (let pic of Object.values(pic_infos)) {
      let url;
      if ((url = pic.largest) && (url = url.url)) {
        download(url, setName(info, idx++, url.match(/\w+$/)[0])); // 下载图片
      }
      if (url = pic.video) {
        download(url, setName(info, idx++, 'mp4')); // 下载 LIVE
      }
    }
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
        downPicture(info);
      }
    });
  }

  /**
   * 判断节点所在微博是否有图片或视频
   */
  function isGood(a) {
    try {
      let box = a.parentNode.parentNode;

      if (!a.href.match(/\d+\/\w+/)) { // 微博链接不正确
        return false;
      }

      if (box.classList.contains('WB_func')) { // 是被转发微博
        box = box.parentNode;
      } else if (box.querySelector('.WB_feed_expand')) { // 是转发微博
        return false;
      }

      if (box.querySelector('.WB_pic:not(.li_birthday,.li_oly)') // 存在图片
        || box.querySelector('.WB_video')) { // 存在视频
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * 初始化，给微博卡片增加按钮
   */
  function init() {
    let aList = document.querySelectorAll( // 列出未被检测的节点
      '.WB_from>a[node-type="feed_list_item_date"]:not(.mdstm)'
    );

    for (let a of aList) {
      a.className += ' mdstm'; // 添加已检测标记
      if (!isGood(a)) {
        continue;
      }
      let b = document.createElement('a'); // 创建下载按钮
      b.className = 'S_txt2';
      b.innerHTML = '下载';
      b.onclick = click;

      a.parentNode.appendChild(b);
    }

    let n = aList.length;
    if (n > 0) {
      console.log('添加了 ' + n + ' 个按钮');
    }
  }

  // 每 5 秒初始化一次
  setInterval(init, 5000);
})();
