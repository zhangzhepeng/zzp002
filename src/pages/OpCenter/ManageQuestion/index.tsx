import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  List,
  message,
  Radio,
  Row,
} from 'antd';
import React, { useEffect, useState } from 'react';
import type { QuestionType } from '@/models/question';
import {
  getQuestion,
  QuestionSearchParams,
  reviewQuestion,
  searchQuestionsByPage,
  updateQuestion,
} from '@/services/question';
import { history } from 'umi';
import reviewStatusEnum, {
  REVIEW_STATUS_MAP,
  reviewStatusInfoMap,
} from '@/constant/reviewStatusEnum';
import { NoAuth } from '@/components/NoAuth';
import { LightFilter, ProFormSelect, ProFormText } from '@ant-design/pro-form';
import { formatDateTimeStr, formatPartDateTimeStr } from '@/utils/utils';
import { getUserSimpleInfo } from '@/services/user';
import SelectTags from '@/components/SelectTags';
import QuestionRejectModal from '@/components/QuestionRejectModal';
import { useModel } from '@@/plugin-model/useModel';
import { useAccess } from '@@/plugin-access/access';
import type { CurrentUser, SimpleUser } from '@/models/user';
import RichTextEditor from '@/components/RichTextEditor';
import AddSingleOptions from '@/components/AddSingleOptions';
import AddMultipleOptions from '@/components/AddMultipleOptions';
import { QUESTION_DIFFICULTY_ENUM, QUESTION_TYPE_ENUM } from '@/constant/question';
import { toNumber } from 'lodash';
import BraftEditor from 'braft-editor';
import { DEFAULT_AVATAR } from '@/constant';
import { getQuestionTitle } from '@/utils/businessUtils';
import { TagType } from '@/models/tag';
import CommentList from '@/pages/QuestionDetail/components/CommentList';
import QuestionList from '@/components/QuestionList';

const FormItem = Form.Item;

const DEFAULT_PAGE_SIZE = 10;

const formItemLayout = {
  labelCol: {
    xs: {
      span: 24,
    },
    sm: {
      span: 4,
    },
  },
  wrapperCol: {
    xs: {
      span: 24,
    },
    sm: {
      span: 20,
    },
  },
};

const submitFormLayout = {
  wrapperCol: {
    xs: {
      span: 24,
    },
    sm: {
      span: 16,
      offset: 4,
    },
  },
};

/**
 * ????????????
 *
 * @constructor
 */
const ManageQuestion: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [questions, setQuestions] = useState<QuestionType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formValue, setFormValue] = useState<Partial<QuestionType>>({});
  const [user, setUser] = useState<SimpleUser>();
  const [questionId, setQuestionId] = useState<string>(history.location.query?.id as string);
  const [currQuestion, setCurrQuestion] = useState<QuestionType>();
  const [commentDrawerVisible, setCommentDrawerVisible] = useState<boolean>(false);
  const [similarSearchParams, setSimilarSearchParams] = useState<QuestionSearchParams>();

  const [form] = Form.useForm();

  const { tagsMap } = useModel('tag');
  const { initialState } = useModel('@@initialState');
  const { currentUser = {} as CurrentUser } = initialState || {};
  const access = useAccess();

  // ???????????????????????????
  let canVisit = false;
  // ??????????????????
  if (access.canAdmin) {
    canVisit = true;
  }
  // ???????????????????????????
  const extraAuthorityTags = currentUser.extraAuthority?.tags ?? [];
  // ?????????????????????????????????
  if (extraAuthorityTags.length > 0) {
    canVisit = true;
  }
  // ???????????????????????????
  const allTags = access.canAdmin ? tagsMap.allTags : extraAuthorityTags;
  const groupTags = access.canAdmin
    ? tagsMap.groupTags
    : [{ name: '??????', tags: extraAuthorityTags }];

  let defaultOrTags: TagType[] = [];
  // ??????????????????????????????
  if (!access.canAdmin) {
    defaultOrTags = extraAuthorityTags;
  }

  const [searchParams, setSearchParams] = useState<QuestionSearchParams>({
    reviewStatus: reviewStatusEnum.REVIEWING,
    orTags: extraAuthorityTags,
    pageSize: DEFAULT_PAGE_SIZE,
    orderKey: '_createTime',
  });

  const loadData = async () => {
    if (currentUser._id && questionId) {
      form.resetFields();
      const res = await getQuestion(questionId);
      if (!res) {
        message.error('??????????????????????????????');
        return;
      }
      setCurrQuestion(res);
      form.setFieldsValue(res);
      const userRes = await getUserSimpleInfo(res.userId);
      setUser(userRes);
    }
  };

  useEffect(() => {
    if (canVisit) {
      searchQuestionsByPage(searchParams)
        .then((res) => {
          setQuestions(res.data);
          setTotal(res.total);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [searchParams, canVisit]);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [questionId, currentUser]);

  /**
   * ????????????
   * @param text
   */
  const doSimilarSearch = async (text: string) => {
    setSimilarSearchParams({
      name: text,
      reviewStatus: reviewStatusEnum.PASS,
      type: form.getFieldValue('type'),
    });
  };

  const doSubmit = async (values: Record<string, any>) => {
    if (!currentUser._id) {
      message.error('???????????????????????????????????????');
      return;
    }
    if (!questionId) {
      return;
    }
    if (!BraftEditor.createEditorState(values.reference)?.toText()) {
      values.reference = '';
    }
    setSubmitting(true);
    const res = await updateQuestion(questionId, values);
    if (res) {
      message.success('????????????');
    } else {
      message.error('????????????');
    }
    setSubmitting(false);
  };

  const onValuesChange = (changedValues: Record<string, any>, allValues: Record<string, any>) => {
    setFormValue(allValues);
  };

  const doPassReview = () => {
    if (!currentUser._id) {
      message.warning('????????????');
      return;
    }
    setSubmitting(true);
    reviewQuestion(questionId, form.getFieldValue('score'), reviewStatusEnum.PASS)
      .then((res) => {
        if (res) {
          message.success('?????????');
        } else {
          message.error('????????????');
        }
      })
      .finally(() => setSubmitting(false));
  };

  const doRejectReview = () => {
    setShowRejectModal(true);
  };

  // ?????????????????????
  const typeRadioGroupOptions = Object.keys(QUESTION_TYPE_ENUM).map((key) => {
    return {
      label: QUESTION_TYPE_ENUM[key],
      value: toNumber(key),
    };
  });

  const questionFilter = (
    <LightFilter
      collapse
      bordered
      labelAlign="left"
      initialValues={{
        reviewStatus: reviewStatusEnum.REVIEWING.toString(),
        orTags: defaultOrTags,
      }}
      onFinish={async (values) => {
        if (values.reviewStatus) {
          values.reviewStatus = parseInt(values.reviewStatus, 10);
        }
        setSearchParams({ ...searchParams, ...values, pageNum: 1 });
      }}
    >
      <ProFormText name="name" label="?????????" />
      <ProFormSelect name="reviewStatus" label="????????????" valueEnum={REVIEW_STATUS_MAP} />
      <ProFormText name="userId" label="??????id" />
      {access.canAdmin && (
        <FormItem label="?????????" name="tags">
          <SelectTags allTags={allTags} groupTags={groupTags} />
        </FormItem>
      )}
      <FormItem label="?????????" name="orTags">
        <SelectTags allTags={allTags} groupTags={groupTags} disabled={!access.canAdmin} />
      </FormItem>
    </LightFilter>
  );

  return canVisit ? (
    <>
      <Row gutter={[24, 24]}>
        <Col md={5} xs={24}>
          <Card title="?????????????????????????????????" extra={questionFilter}>
            <List<QuestionType>
              rowKey="_id"
              loading={loading}
              dataSource={questions}
              pagination={{
                pageSize: DEFAULT_PAGE_SIZE,
                current: searchParams.pageNum ?? 1,
                showSizeChanger: false,
                showQuickJumper: true,
                total,
                showTotal() {
                  return `?????? ${total}`;
                },
                onChange(pageNum) {
                  const params = {
                    ...searchParams,
                    pageNum,
                  };
                  setSearchParams(params);
                },
              }}
              renderItem={(item) => {
                const reviewStatusInfo = reviewStatusInfoMap[item.reviewStatus];
                return (
                  <List.Item key={item._id}>
                    <List.Item.Meta
                      title={
                        <a
                          style={{ color: reviewStatusInfo.color }}
                          onClick={() => setQuestionId(item._id)}
                        >
                          {'?????????' + getQuestionTitle(item)}
                        </a>
                      }
                      description={formatPartDateTimeStr(item._createTime)}
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        <Col md={13} xs={24}>
          <Card
            title="???????????? / ??????"
            key={questionId}
            extra={
              currQuestion && (
                <Button type="primary" size="small" onClick={() => setCommentDrawerVisible(true)}>
                  ????????????
                </Button>
              )
            }
          >
            <Form
              style={{
                marginTop: 8,
              }}
              form={form}
              name="question"
              {...formItemLayout}
              labelAlign="left"
              initialValues={{
                score: 5,
              }}
              scrollToFirstError
              onFinish={doSubmit}
              onValuesChange={onValuesChange}
            >
              <FormItem
                label="??????"
                name="type"
                rules={[
                  {
                    required: true,
                    message: '?????????????????????',
                  },
                ]}
              >
                <Radio.Group options={typeRadioGroupOptions} />
              </FormItem>
              <FormItem
                label="??????"
                name="difficulty"
                rules={[
                  {
                    required: true,
                    message: '?????????????????????',
                  },
                ]}
              >
                <Radio.Group>
                  {Object.keys(QUESTION_DIFFICULTY_ENUM).map((key) => {
                    return (
                      <Radio key={key} value={toNumber(key)}>
                        {QUESTION_DIFFICULTY_ENUM[key]}
                      </Radio>
                    );
                  })}
                </Radio.Group>
              </FormItem>
              <FormItem
                label="??????"
                name="tags"
                rules={[
                  {
                    required: true,
                    message: '???????????? 1 ?????????',
                  },
                  {
                    max: 5,
                    type: 'array',
                    message: '???????????? 5 ?????????',
                  },
                ]}
              >
                <SelectTags
                  allTags={tagsMap.allTags}
                  groupTags={tagsMap.groupTags}
                  maxTagsNumber={20}
                />
              </FormItem>
              <FormItem
                label="??????"
                name="detail"
                rules={[
                  {
                    required: true,
                    message: '???????????????',
                  },
                ]}
              >
                {/* @ts-ignore */}
                <RichTextEditor
                  placeholder="???????????????????????????????????????????????????????????????"
                  onBlur={(_, __, editor) => {
                    // ????????????
                    doSimilarSearch(editor.getText());
                  }}
                />
              </FormItem>
              {formValue.type === 1 ? (
                <FormItem label="????????????" name="params">
                  <AddSingleOptions />
                </FormItem>
              ) : null}
              {formValue.type === 2 ? (
                <FormItem label="????????????" name="params">
                  <AddMultipleOptions />
                </FormItem>
              ) : null}
              <FormItem label="????????????" name="reference">
                {/* @ts-ignore */}
                <RichTextEditor placeholder="?????????????????????????????????" />
              </FormItem>
              <FormItem label="????????????" name="name">
                <Input placeholder="?????????????????????????????????????????????" maxLength={100} allowClear />
              </FormItem>
              <FormItem label="?????????" name="priority">
                <InputNumber min={0} placeholder="999 ????????????" />
              </FormItem>
              <FormItem label="????????????" name="score">
                <InputNumber min={0} max={8} />
              </FormItem>
              <FormItem
                {...submitFormLayout}
                style={{
                  marginTop: 32,
                }}
              >
                <Row gutter={24}>
                  <Col span={6}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      ghost
                      block
                      loading={submitting}
                      disabled={submitting || !questionId}
                    >
                      {submitting ? '?????????' : '??????'}
                    </Button>
                  </Col>
                  <Col span={6}>
                    <Button
                      type="primary"
                      block
                      loading={submitting}
                      disabled={submitting || !questionId}
                      onClick={doPassReview}
                    >
                      {submitting ? '?????????' : '??????'}
                    </Button>
                  </Col>
                  <Col span={6}>
                    <Button
                      type="primary"
                      danger
                      block
                      loading={submitting}
                      disabled={submitting || !questionId}
                      onClick={doRejectReview}
                    >
                      {submitting ? '?????????' : '??????'}
                    </Button>
                  </Col>
                </Row>
              </FormItem>
            </Form>
          </Card>
        </Col>
        <Col md={6} xs={24}>
          <Card title="????????????" bodyStyle={{ paddingBottom: 12 }}>
            {currQuestion ? (
              <Descriptions column={1}>
                <Descriptions.Item label="?????????">
                  <Avatar src={user?.avatarUrl || DEFAULT_AVATAR} style={{ marginRight: 5 }} />
                  {user?.nickName}
                </Descriptions.Item>
                <Descriptions.Item label="?????????">{currQuestion.viewNum}</Descriptions.Item>
                <Descriptions.Item label="?????????">{currQuestion.commentNum}</Descriptions.Item>
                <Descriptions.Item label="?????????">{currQuestion.favourNum}</Descriptions.Item>
                <Descriptions.Item label="????????????">
                  {formatDateTimeStr(currQuestion._createTime)}
                </Descriptions.Item>
                <Descriptions.Item label="????????????">
                  {formatDateTimeStr(currQuestion._updateTime)}
                </Descriptions.Item>
                <Descriptions.Item label="????????????">
                  {formatDateTimeStr(currQuestion.reviewTime)}
                </Descriptions.Item>
                <Descriptions.Item label="????????????">
                  {formatDateTimeStr(currQuestion.publishTime)}
                </Descriptions.Item>
                <Descriptions.Item label="????????????">{currQuestion.reviewMessage}</Descriptions.Item>
              </Descriptions>
            ) : (
              '?????????????????????????????????'
            )}
          </Card>
          <Card title="????????????????????????????????????" style={{ marginTop: 24 }} bodyStyle={{ paddingTop: 12 }}>
            {similarSearchParams?.name?.trim() ? (
              <QuestionList searchParams={similarSearchParams} />
            ) : (
              <div>??????????????????????????????</div>
            )}
          </Card>
        </Col>
      </Row>
      <QuestionRejectModal
        visible={showRejectModal}
        questionId={questionId}
        onClose={() => setShowRejectModal(false)}
      />
      {currQuestion && (
        <Drawer
          title="????????????"
          placement="right"
          width="80%"
          contentWrapperStyle={{ maxWidth: 800 }}
          onClose={() => setCommentDrawerVisible(false)}
          visible={commentDrawerVisible}
        >
          <CommentList question={currQuestion} />
        </Drawer>
      )}
    </>
  ) : (
    <NoAuth />
  );
};

export default ManageQuestion;
