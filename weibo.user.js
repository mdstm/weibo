// ==UserScript==
// @name         微博图片下载脚本
// @homepage     https://github.com/mdstm/weibo
// @version      6.0
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
   * @param  {object} info 微博信息
   * @param  {number} idx  序号
   * @param  {string} ext  扩展名，不带点
   * @return {string}      下载名称
   */
  function setName(info, idx, ext) {
    let t = new Date(info.created_at);
    t.setTime(t.getTime() - t.getTimezoneOffset() * 60000 + idx * 1000);
    t = t.toISOString().substring(2, 19);
    return t.replace(/[-:]/g, '').replace('T', '_') + '.' + ext;
  }

  /**
   * 下载
   * @param {string} url  链接
   * @param {string} name 下载名称
   */
  function download(url, name) {
    GM_download({
      url: url,
      name: name,
      headers: [{name: 'referer', value: 'https://weibo.com/'}],
      onerror: function() { console.error('下载 ' + name + ' 失败\n' + url); },
      ontimeout: function() { download(url, name); }
    });
  }

  /**
   * 下载图片和视频
   */
  function downPicture(info) {
    let url, idx = 0, ext;

    if (info.pic_infos) { // 普通图片
      console.log('找到普通图片，开始下载图片');
      for (let pic of Object.values(info.pic_infos)) {
        url = pic.largest.url;
        ext = url.match(/\w+$/)[0];
        download(url, setName(info, idx++, ext)); // 下载图片
        if (ext != 'gif' && pic.video) {
          download(pic.video, setName(info, idx++, 'mp4')); // 下载 LIVE
        }
      }
      return;
    }

    if (info.page_info) {
      let page_info = info.page_info;

      if (page_info.media_info) { // 普通视频
        let media_info = page_info.media_info;
        try {
          url = media_info.playback_list[0].play_info.url;
        } catch (e) {}
        if (url
        || (url = media_info.mp4_720p_mp4)
        || (url = media_info.mp4_hd_url)
        || (url = media_info.mp4_sd_url)) {
          console.log('找到普通视频，开始下载视频');
          download(url, setName(info, 0, 'mp4')); // 下载视频
          return;
        }
      }

      try { // 微博故事
        url = page_info.slide_cover.playback_list[0].play_info.url.toString();
        console.log('找到微博故事，开始下载视频');
        download(url, setName(info, 0, 'mp4')); // 下载视频
        return;
      } catch (e) {}

      try { // 明星动态
        url = page_info.card_info.pic_url.toString();
        ext = url.match(/\w+$/)[0];
        console.log('找到明星动态，开始下载图片');
        download(url, setName(info, 0, ext)); // 下载图片
        return;
      } catch (e) {}
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
        downPicture(info);
      }
    });
  }

  // /**
  //  * 判断节点所在微博是否有图片或视频
  //  */
  // function isGood(a) {
  //   try {
  //     let box = a.parentNode.parentNode;

  //     if (!a.href.match(/\d+\/\w+/)) { // 微博链接不正确
  //       return false;
  //     }

  //     if (box.classList.contains('WB_func')) { // 是被转发微博
  //       box = box.parentNode;
  //     } else if (box.querySelector('.WB_feed_expand')) { // 是转发微博
  //       return false;
  //     }

  //     if (box.querySelector('.WB_pic') // 存在图片
  //     || box.querySelector('.WB_video')) { // 存在视频
  //       return true;
  //     }
  //     return false;
  //   } catch (e) {
  //     return false;
  //   }
  // }

  /**
   * 初始化，给微博卡片增加按钮
   */
  function init() {
    let aList = document.querySelectorAll( // 列出未被检测的节点
      // '.WB_from>a[node-type="feed_list_item_date"]:not(.mdstm)'
      'a.head-info_time_6sFQg:nth-child(1):not(.mdstm)'
    );

    for (let a of aList) {
      a.className += ' mdstm'; // 添加已检测标记
      // if (!isGood(a)) {
      //   continue;
      // }
      let b = document.createElement('a'); // 创建下载按钮
      b.className = 'head-info_time_6sFQg';
      b.style.cursor = 'pointer';
      b.innerHTML = '下载';
      b.onclick = click;

      // a.parentNode.appendChild(b);
      a.parentNode.insertBefore(b, a.nextSibling);
    }

    let n = aList.length;
    if (n > 0) {
      console.log('添加了 ' + n + ' 个按钮');
    }
  }

  // 每 5 秒初始化一次
  setInterval(init, 5000);
})();
