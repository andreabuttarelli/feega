export const KIE_CREATED = { code: 200, msg: 'success', data: { taskId: 'task_nano-banana-2_1765178625768' } };

export const KIE_REFUSED_IN_BODY = { code: 422, msg: 'resolution is not within the range of allowed options', data: null };

export const KIE_WAITING = {
  code: 200,
  msg: 'success',
  data: { taskId: 'task_nano-banana-2_1765178625768', model: 'nano-banana-2', state: 'generating', resultJson: '', failCode: '', failMsg: '', costTime: 0, creditsConsumed: 0 }
};

export const KIE_SUCCESS = {
  code: 200,
  msg: 'success',
  data: {
    taskId: 'task_nano-banana-2_1765178625768',
    model: 'nano-banana-2',
    state: 'success',
    param: '{"model":"nano-banana-2","input":"{\\"prompt\\":\\"a lake\\",\\"resolution\\":\\"1K\\"}"}',
    resultJson: '{"resultUrls":["https://tempfile.aiquickdraw.com/h/ab12.png"]}',
    failCode: '',
    failMsg: '',
    costTime: 15,
    completeTime: 1765178640768,
    createTime: 1765178625768,
    creditsConsumed: 8
  }
};

export const KIE_FAILED = {
  code: 200,
  msg: 'success',
  data: { taskId: 'task_x', model: 'nano-banana-2', state: 'fail', resultJson: null, failCode: '500', failMsg: 'Internal error, please try again later.', costTime: 3, creditsConsumed: 0 }
};

export const KIE_EMPTY_RECORD = { code: 200, msg: 'success', data: null };
