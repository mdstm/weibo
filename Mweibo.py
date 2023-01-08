import httpx
from tqdm import tqdm

import time
import re
from datetime import datetime, timedelta
from sys import argv


headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko',
    'referer': 'https://weibo.com/'
}
# 获取微博信息的接口
info_url = 'https://weibo.com/ajax/statuses/show?id={mblogid}'
# 下载图片的接口 (需要 cookie)
# imag_url = 'https://weibo.com/ajax/common/download?pid={pid}'


def download(client: httpx.Client, url: str, name: str):
    "下载文件, 显示下载进度"
    with client.stream('GET', url) as res:
        res.raise_for_status()
        total = int(res.headers['content-length'])

        with tqdm(
            desc=name,
            total=total,
            ncols=100,
            unit='iB',
            unit_scale=True,
            unit_divisor=1024
        ) as bar, open(name, 'wb') as f:
            for chunk in res.iter_bytes(chunk_size=1048576):
                size = f.write(chunk)
                bar.update(size)


def downloadHard(client: httpx.Client, url: str, name: str):
    "努力下载, 多次重试之后再抛异常"
    for _ in range(5):
        try:
            download(client, url, name)
            break
        except Exception as e:
            print(e)
            time.sleep(6)
    else:
        raise Exception('重试次数用尽, 无法继续下载')


def getInfo(client: httpx.Client, wb_url: str):
    "获取微博信息"
    mblogid = re.search(r'\w+$', wb_url).group() # 微博 id
    res = client.get(info_url.format(mblogid=mblogid)) # 调用接口
    res.raise_for_status()
    return res.json()


def getName(wb_time: datetime, idx: int, ext: str) -> str:
    "计算本地文件名"
    t = wb_time + timedelta(seconds=idx) # 增加秒数
    return t.strftime('%y%m%d_%H%M%S') + ext


def choice(obj, *paths):
    "从多个路径中选出第一个可达到的目标"
    for path in paths:
        try:
            a = obj
            for k in path:
                a = a[k]
            return a
        except Exception:
            pass
    return None


def getMedia(client: httpx.Client, wb_url: str):
    "从微博中寻找图片和视频并下载"
    wb_info = getInfo(client, wb_url) # 微博信息
    wb_time = wb_info['created_at'] # 微博创建时间
    wb_time = datetime.strptime(wb_time, '%a %b %d %H:%M:%S %z %Y')

    pic_infos = wb_info.get('pic_infos')
    if pic_infos:
        print('找到图片')
        idx = 0
        for pic in pic_infos.values():
            url = pic['largest']['url'] # 图片链接
            ext = re.search(r'\.\w+$', url).group() # 图片扩展名
            downloadHard(client, url, getName(wb_time, idx, ext))
            idx += 1
            if ext == '.gif':
                continue
            url = pic.get('video') # LIVE 链接
            if url:
                downloadHard(client, url, getName(wb_time, idx, '.mp4'))
                idx += 1
        return

    page_info = wb_info.get('page_info')
    if page_info:
        media_info = page_info.get('media_info')
        if media_info:
            url = choice(media_info, # 视频链接
                ('playback_list', 0, 'play_info', 'url'),
                ('mp4_720p_mp4',),
                ('mp4_hd_url',),
                ('mp4_sd_url',))
            if url:
                print('找到视频')
                downloadHard(client, url, getName(wb_time, 0, '.mp4'))
                return

        url = choice(page_info, # 微博故事链接
            ('slide_cover', 'playback_list', 0, 'play_info', 'url'))
        if url:
            print('找到微博故事')
            downloadHard(client, url, getName(wb_time, 0, '.mp4'))
            return

        url = choice(page_info, ('card_info', 'pic_url')) # 明星动态图片链接
        if url:
            print('找到明星动态图片')
            ext = re.search(r'\.\w+$', url).group()
            downloadHard(client, url, getName(wb_time, 0, ext))
            return

    print('未找到图片或视频')


def main():
    with httpx.Client(headers=headers, follow_redirects=True) as client:
        if len(argv) < 2: # 交互模式
            while True:
                try:
                    wb_url = input('请输入微博链接, 输入 x 退出:\n')
                    if wb_url == 'x':
                        return
                    getMedia(client, wb_url)
                except Exception as e:
                    print(e)
                print()

        if argv[1] == '-f' and len(argv) > 2: # 读取文件中的微博链接
            with open(argv[2], 'r') as f:
                for wb_url in f.read().split():
                    print(wb_url)
                    getMedia(client, wb_url)
                    print()
            return

        getMedia(client, argv[1]) # 从参数中获取微博链接


if __name__ == '__main__':
    main()
