package edu.daa.dna.algorithm;

import java.util.*;

/** Six independently callable implementations; full tables additionally support reconstruction. */
public final class DynamicProgramming {
  private DynamicProgramming() {}
  public static int lcsMemo(String a, String b) { Integer[][] m=new Integer[a.length()+1][b.length()+1]; return lcsMemo(a,b,a.length(),b.length(),m); }
  private static int lcsMemo(String a,String b,int i,int j,Integer[][] m){ if(i==0||j==0)return 0; if(m[i][j]!=null)return m[i][j]; return m[i][j]=a.charAt(i-1)==b.charAt(j-1)?1+lcsMemo(a,b,i-1,j-1,m):Math.max(lcsMemo(a,b,i-1,j,m),lcsMemo(a,b,i,j-1,m)); }
  public static int[][] lcsTable(String a,String b){int[][] d=new int[a.length()+1][b.length()+1];for(int i=1;i<=a.length();i++)for(int j=1;j<=b.length();j++)d[i][j]=a.charAt(i-1)==b.charAt(j-1)?d[i-1][j-1]+1:Math.max(d[i-1][j],d[i][j-1]);return d;}
  public static int lcsRolling(String a,String b){if(b.length()>a.length()){String t=a;a=b;b=t;}int[] p=new int[b.length()+1],c=new int[b.length()+1];for(int i=1;i<=a.length();i++){for(int j=1;j<=b.length();j++)c[j]=a.charAt(i-1)==b.charAt(j-1)?p[j-1]+1:Math.max(p[j],c[j-1]);int[]t=p;p=c;c=t;}return p[b.length()];}
  public static int editMemo(String a,String b){Integer[][]m=new Integer[a.length()+1][b.length()+1];return editMemo(a,b,a.length(),b.length(),m);}
  private static int editMemo(String a,String b,int i,int j,Integer[][]m){if(i==0)return j;if(j==0)return i;if(m[i][j]!=null)return m[i][j];int cost=a.charAt(i-1)==b.charAt(j-1)?0:1;return m[i][j]=Math.min(Math.min(editMemo(a,b,i-1,j,m)+1,editMemo(a,b,i,j-1,m)+1),editMemo(a,b,i-1,j-1,m)+cost);}
  public static int[][] editTable(String a,String b){int[][]d=new int[a.length()+1][b.length()+1];for(int i=0;i<=a.length();i++)d[i][0]=i;for(int j=0;j<=b.length();j++)d[0][j]=j;for(int i=1;i<=a.length();i++)for(int j=1;j<=b.length();j++){int c=a.charAt(i-1)==b.charAt(j-1)?0:1;d[i][j]=Math.min(Math.min(d[i-1][j]+1,d[i][j-1]+1),d[i-1][j-1]+c);}return d;}
  public static int editRolling(String a,String b){if(b.length()>a.length()){String t=a;a=b;b=t;}int[]p=new int[b.length()+1],c=new int[b.length()+1];for(int j=0;j<=b.length();j++)p[j]=j;for(int i=1;i<=a.length();i++){c[0]=i;for(int j=1;j<=b.length();j++){int cost=a.charAt(i-1)==b.charAt(j-1)?0:1;c[j]=Math.min(Math.min(p[j]+1,c[j-1]+1),p[j-1]+cost);}int[]t=p;p=c;c=t;}return p[b.length()];}
}
