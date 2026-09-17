// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { observeSubmissions } from '../submission-observer';

let dispose: () => void;
const network = vi.fn<typeof fetch>();
const accepted = vi.fn();
beforeEach(() => {
  window.history.replaceState({}, '', '/problems/two-sum/');
  vi.stubGlobal('fetch', network);
  dispose = observeSubmissions(accepted);
});
afterEach(() => dispose());
async function request(path: string, body: unknown, method = 'GET') {
  network.mockResolvedValueOnce(Response.json(body));
  const response = await window.fetch(path, { method });
  await vi.waitFor(() => expect(network).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
  return response;
}
it.each(['check', 'v2/check'])(
  'opens once for a new Accepted submission through %s, including subsequent reviews',
  async (checkPath) => {
    await request(`/submissions/detail/1/${checkPath}/`, { state: 'SUCCESS', status_code: 10 });
    expect(accepted).not.toHaveBeenCalled();
    await request('/problems/two-sum/submit/', { submission_id: 2 }, 'POST');
    await request(`/submissions/detail/2/${checkPath}/`, { state: 'PENDING' });
    expect(accepted).not.toHaveBeenCalled();
    const response = await request(`/submissions/detail/2/${checkPath}/`, { state: 'SUCCESS', status_code: 10 });
    expect(await response.json()).toEqual({ state: 'SUCCESS', status_code: 10 });
    await request(`/submissions/detail/2/${checkPath}/`, { state: 'SUCCESS', status_code: 10 });
    expect(accepted).toHaveBeenCalledExactlyOnceWith({ slug: 'two-sum', submissionId: '2' });
    await request('/problems/two-sum/submit/', { submission_id: 3 }, 'POST');
    await request(`/submissions/detail/3/${checkPath}/`, { state: 'SUCCESS', status_code: 10 });
    expect(accepted).toHaveBeenCalledTimes(2);
  }
);
it('ignores rejected submissions, test runs, navigation, and results after disposal', async () => {
  await request('/problems/two-sum/interpret_solution/', { interpret_id: '1' }, 'POST');
  await request('/submissions/detail/1/check/', { state: 'SUCCESS', status_code: 10 });
  await request('/problems/two-sum/submit/', { submission_id: 2 }, 'POST');
  await request('/submissions/detail/2/check/', { state: 'SUCCESS', status_code: 11 });
  await request('/problems/two-sum/submit/', { submission_id: 3 }, 'POST');
  window.history.replaceState({}, '', '/problems/add-two-numbers/');
  await request('/submissions/detail/3/check/', { state: 'SUCCESS', status_code: 10 });
  dispose();
  await request('/problems/add-two-numbers/submit/', { submission_id: 4 }, 'POST');
  await request('/submissions/detail/4/check/', { state: 'SUCCESS', status_code: 10 });
  expect(accepted).not.toHaveBeenCalled();
});

it('forgets pending submissions when navigating away and back to a problem', async () => {
  await request('/problems/two-sum/submit/', { submission_id: 2 }, 'POST');
  window.history.pushState({}, '', '/problems/add-two-numbers/');
  window.history.pushState({}, '', '/problems/two-sum/');
  await request('/submissions/detail/2/check/', { state: 'SUCCESS', status_code: 10 });
  expect(accepted).not.toHaveBeenCalled();
});

it('observes XHR submissions and JSON results without changing the page response', () => {
  dispose();
  const open = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {});
  const send = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {});
  dispose = observeSubmissions(accepted);
  const submit = new XMLHttpRequest();
  submit.open('POST', '/problems/two-sum/submit/');
  const body = JSON.stringify({ lang: 'python3', typed_code: 'return [0, 1]' });
  submit.send(body);
  Object.defineProperty(submit, 'responseText', { value: '{"submission_id":7}' });
  submit.dispatchEvent(new Event('load'));
  const result = new XMLHttpRequest();
  result.open('GET', '/submissions/detail/7/check/');
  result.responseType = 'json';
  const response = { state: 'SUCCESS', status_code: 10 };
  Object.defineProperty(result, 'response', { value: response });
  result.send();
  result.dispatchEvent(new Event('load'));
  expect(open.mock.calls.map(([method, url]) => [method, url])).toEqual([
    ['POST', '/problems/two-sum/submit/'],
    ['GET', '/submissions/detail/7/check/'],
  ]);
  expect(open.mock.contexts).toEqual([submit, result]);
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenNthCalledWith(1, body);
  expect(send.mock.contexts).toEqual([submit, result]);
  expect(result.response).toBe(response);
  expect(accepted).toHaveBeenCalledExactlyOnceWith({ slug: 'two-sum', submissionId: '7' });
});
