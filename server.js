const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 数据库自动创建
const db = new sqlite3.Database('./drama_video.db');

// 短剧信息表
db.run(`CREATE TABLE IF NOT EXISTS drama_info (
  drama_id TEXT PRIMARY KEY,
  cover TEXT NOT NULL,
  title TEXT NOT NULL,
  total INTEGER NOT NULL,
  type TEXT NOT NULL,
  desc TEXT NOT NULL,
  free_num INTEGER NOT NULL DEFAULT 2
)`);

// 用户解锁记录表
db.run(`CREATE TABLE IF NOT EXISTS user_unlock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT NOT NULL,
  drama_id TEXT NOT NULL,
  episode INTEGER NOT NULL,
  create_time INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(openid, drama_id, episode)
)`);

// ====================== 小程序用户接口（视频号进入调用） ======================
// 获取短剧详情+每集解锁状态
app.get('/api/drama/detail', (req, res) => {
  const { openid, drama_id } = req.query;
  if (!openid || !drama_id) return res.json({ code: -1, msg: '参数错误' });

  db.get(`SELECT * FROM drama_info WHERE drama_id=?`, [drama_id], (err, drama) => {
    if (!drama) return res.json({ code: -2, msg: '短剧不存在' });

    db.all(`SELECT episode FROM user_unlock WHERE openid=? AND drama_id=?`, [openid, drama_id], (err, rows) => {
      const unlockedList = rows.map(i => i.episode);
      const episodeStatus = [];

      for (let i = 1; i <= drama.total; i++) {
        let status;
        if (i <= drama.free_num) status = 'free';
        else if (unlockedList.includes(i)) status = 'unlocked';
        else status = 'locked';

        episodeStatus.push({ episode: i, status });
      }

      res.json({
        code: 0,
        data: {
          cover: drama.cover,
          title: drama.title,
          total: drama.total,
          type: drama.type,
          desc: drama.desc,
          free_num: drama.free_num,
          episodeStatus: episodeStatus
        }
      });
    });
  });
});

// 广告解锁上报接口
app.post('/api/drama/unlock', (req, res) => {
  const { openid, drama_id, episode } = req.body;
  if (!openid || !drama_id || !episode) return res.json({ code: -1 });

  db.run(`INSERT OR IGNORE INTO user_unlock(openid,drama_id,episode) VALUES(?,?,?)`,
    [openid, drama_id, episode], () => {
      res.json({ code: 0, msg: '解锁成功' });
    });
});

// ====================== 后台管理接口（你自己用） ======================
// 获取所有短剧列表
app.get('/api/admin/drama/list', (req, res) => {
  db.all(`SELECT * FROM drama_info`, [], (err, rows) => {
    res.json({ code: 0, data: rows });
  });
});

// 添加/编辑短剧
app.post('/api/admin/drama/save', (req, res) => {
  const { drama_id, cover, title, total, type, desc, free_num } = req.body;
  db.run(`REPLACE INTO drama_info(drama_id,cover,title,total,type,desc,free_num)
          VALUES(?,?,?,?,?,?,?)`,
    [drama_id, cover, title, total, type, desc, free_num],
    () => res.json({ code: 0 })
  );
});

// 删除短剧
app.post('/api/admin/drama/delete', (req, res) => {
  db.run(`DELETE FROM drama_info WHERE drama_id=?`, [req.body.drama_id], () => {
    res.json({ code: 0 });
  });
});

// 查看所有用户解锁记录
app.get('/api/admin/unlock/list', (req, res) => {
  db.all(`SELECT * FROM user_unlock`, [], (err, rows) => {
    res.json({ code: 0, data: rows });
  });
});

// 挂载后台管理网页
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// 首页检测
app.get('/', (req, res) => res.send('视频号短剧后端+后台管理 运行正常'));

// 启动服务
const PORT = 3000;
app.listen(PORT, () => {
  console.log('后端启动成功：http://localhost:' + PORT);
  console.log('后台管理地址：http://localhost:' + PORT + '/admin');
});